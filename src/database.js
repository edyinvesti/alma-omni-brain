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
                console.log('[DB] Conectado ao Turso');
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

    // ✅ NOV0: Inicializa tabelas
    async initTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                tokens INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS memory (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT DEFAULT 'user',
                embedding BLOB,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT DEFAULT 'info',
                message TEXT NOT NULL,
                context TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                target TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT,
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

    // ✅ NOV0: Queries estruturadas
    async historyAdd(role, content, model = null, tokens = null) {
        if (!this.client) await this.connect();
        if (!this.client) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'INSERT INTO history (role, content, model, tokens) VALUES (?, ?, ?, ?)',
                args: [role, content, model, tokens]
            });
            return result;
        } catch (e) {
            console.log('[DB] Erro ao adicionar history:', e.message);
            return null;
        }
    }

    async historyGet(limit = 20) {
        if (!this.client) await this.connect();
        if (!this.client) return [];
        
        try {
            const result = await this.client.execute({
                sql: 'SELECT * FROM history ORDER BY id DESC LIMIT ?',
                args: [limit]
            });
            return result.rows || [];
        } catch (e) {
            console.log('[DB] Erro ao buscar history:', e.message);
            return [];
        }
    }

    async memorySet(key, value) {
        if (!this.client) await this.connect();
        if (!this.client) return null;
        
        try {
            await this.client.execute({
                sql: 'INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                args: [key, value]
            });
            return true;
        } catch (e) {
            console.log('[DB] Erro ao setar memory:', e.message);
            return false;
        }
    }

    async memoryGet(key) {
        if (!this.client) await this.connect();
        if (!this.client) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'SELECT * FROM memory WHERE key = ?',
                args: [key]
            });
            return result.rows?.[0]?.value || null;
        } catch (e) {
            console.log('[DB] Erro ao buscar memory:', e.message);
            return null;
        }
    }

    async knowledgeAdd(title, content, source = 'user') {
        if (!this.client) await this.connect();
        if (!this.client) return null;
        
        try {
            const result = await this.client.execute({
                sql: 'INSERT INTO knowledge (title, content, source) VALUES (?, ?, ?)',
                args: [title, content, source]
            });
            return result;
        } catch (e) {
            console.log('[DB] Erro ao adicionar knowledge:', e.message);
            return null;
        }
    }

    async knowledgeSearch(query, limit = 5) {
        if (!this.client) await this.connect();
        if (!this.client) return [];
        
        try {
            const result = await this.client.execute({
                sql: `SELECT * FROM knowledge WHERE title LIKE ? OR content LIKE ? LIMIT ?`,
                args: [`%${query}%`, `%${query}%`, limit]
            });
            return result.rows || [];
        } catch (e) {
            console.log('[DB] Erro ao buscar knowledge:', e.message);
            return [];
        }
    }

    async log(level, message, context = null) {
        if (!this.client) await this.connect();
        if (!this.client) return;
        
        try {
            await this.client.execute({
                sql: 'INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
                args: [level, message, context]
            });
        } catch (e) {
            console.warn('[DB] Erro:', e.message);
        }
    }

    async actionLog(type, target, status = 'pending', result = null) {
        if (!this.client) await this.connect();
        if (!this.client) return;
        
        try {
            await this.client.execute({
                sql: 'INSERT INTO actions (type, target, status, result) VALUES (?, ?, ?, ?)',
                args: [type, target, status, result]
            });
        } catch (e) {
            console.warn('[DB] Erro:', e.message);
        }
    }

    // ✅ NOV0: Conexão de backup
    async reconnect() {
        this.connected = false;
        this.client = null;
        return await this.connect();
    }
}

// Singleton
module.exports = new Database();