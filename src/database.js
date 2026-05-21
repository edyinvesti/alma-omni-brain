const { createClient } = require('@libsql/client');

class Database {
    constructor() {
        this.client = null;
        this.connected = false;
        this._connectPromise = null;
    }

    async connect() {
        if (this.connected && this.client) {
            return this.client;
        }
        if (this._connectPromise) return this._connectPromise;

        const url = process.env.TURSO_DATABASE_URL;
        const token = process.env.TURSO_AUTH_TOKEN;

        if (!url || !token) {
            console.log('[DB] Credenciais não configuradas');
            return null;
        }

        let retries = 3;
        while (retries > 0) {
            try {
                this.client = createClient({ url, authToken: token });
                this.connected = true;
                console.log('[DB] Conectado ao Turso (Multi-Tenant)');
                await this.initTables();
                this._connectPromise = null;
                return this.client;
            } catch (e) {
                retries--;
                console.log(`[DB] Erro ao conectar: ${e.message}. Tentativas: ${retries}`);
                if (retries > 0) await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        return null;
    }

    // Inicializa tabelas com company_id
    async initTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                tokens INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, key)
            )`,
            `CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT DEFAULT 'user',
                embedding BLOB,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                level TEXT DEFAULT 'info',
                message TEXT NOT NULL,
                context TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                type TEXT NOT NULL,
                target TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            // Tabela CRM por segurança, caso precisemos criar no connect e não apenas no migrate
            `CREATE TABLE IF NOT EXISTS crm_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                name TEXT,
                phone TEXT,
                email TEXT,
                source TEXT,
                status TEXT DEFAULT 'novo',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            try {
                await this.client.execute(sql);
            } catch (e) {
                console.log(`[DB] Erro ao criar tabela: ${e.message}`);
            }
        }
    }

    async historyAdd(role, content, companyId, model = null, tokens = null) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'INSERT INTO history (company_id, role, content) VALUES (?, ?, ?)',
                args: [companyId, role, content]
            });
            return result;
        } catch (e) {
            console.log('[DB] Erro ao adicionar history:', e.message);
            return null;
        }
    }

    async historyGet(limit = 20, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return [];
        
        try {
            const result = await this.client.execute({
                sql: 'SELECT * FROM history WHERE company_id = ? ORDER BY id DESC LIMIT ?',
                args: [companyId, limit]
            });
            return result.rows || [];
        } catch (e) {
            console.log('[DB] Erro ao buscar history:', e.message);
            return [];
        }
    }

    async memorySet(key, value, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return null;
        
        try {
            // Usa INSERT OR REPLACE mas checa a constraint UNIQUE(company_id, key)
            await this.client.execute({
                sql: 'INSERT INTO memory (company_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(company_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
                args: [companyId, key, value]
            });
            return true;
        } catch (e) {
            console.log('[DB] Erro ao setar memory:', e.message);
            return false;
        }
    }

    async memoryGet(key, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'SELECT * FROM memory WHERE company_id = ? AND key = ?',
                args: [companyId, key]
            });
            return result.rows?.[0]?.value || null;
        } catch (e) {
            console.log('[DB] Erro ao buscar memory:', e.message);
            return null;
        }
    }

    async knowledgeAdd(source = 'user', title, content, embedding = null, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'INSERT INTO knowledge (company_id, title, content, source, embedding) VALUES (?, ?, ?, ?, ?)',
                args: [companyId, title, content, source, embedding]
            });
            return result;
        } catch (e) {
            console.log('[DB] Erro ao adicionar knowledge:', e.message);
            return null;
        }
    }

    async knowledgeSearch(query, limit = 5, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return [];
        
        try {
            const result = await this.client.execute({
                sql: `SELECT * FROM knowledge WHERE company_id = ? AND (title LIKE ? OR content LIKE ?) LIMIT ?`,
                args: [companyId, `%${query}%`, `%${query}%`, limit]
            });
            return result.rows || [];
        } catch (e) {
            console.log('[DB] Erro ao buscar knowledge:', e.message);
            return [];
        }
    }

    async logInteraction(level, message, context = null, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return;
        
        try {
            await this.client.execute({
                sql: 'INSERT INTO logs (company_id, level, message, context) VALUES (?, ?, ?, ?)',
                args: [companyId, level, message, context]
            });
        } catch (e) {
            console.warn('[DB] Erro:', e.message);
        }
    }

    async actionLog(type, target, status = 'pending', result = null, companyId) {
        if (!this.client) await this.connect();
        if (!this.client || !companyId) return;
        
        try {
            await this.client.execute({
                sql: 'INSERT INTO actions (company_id, type, target, status, result) VALUES (?, ?, ?, ?, ?)',
                args: [companyId, type, target, status, result]
            });
        } catch (e) {
            console.warn('[DB] Erro:', e.message);
        }
    }

    async reconnect() {
        this.connected = false;
        this.client = null;
        return await this.connect();
    }
}

// Singleton
module.exports = new Database();