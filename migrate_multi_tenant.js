require('dotenv').config();
const { createClient } = require('@libsql/client');

async function migrate() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url || !token) {
        console.error('❌ URL ou Token do Turso ausentes no .env.');
        process.exit(1);
    }

    const db = createClient({ url, authToken: token });
    console.log('🔄 Iniciando migração para a Arquitetura LEGO Multi-Tenant...');

    const tables = ['history', 'knowledge', 'logs', 'actions'];

    for (const table of tables) {
        try {
            console.log(`[${table}] Verificando a presença da coluna company_id...`);
            
            // Adicionar a coluna (isso falhará inofensivamente se a coluna já existir)
            try {
                await db.execute(`ALTER TABLE ${table} ADD COLUMN company_id TEXT DEFAULT 'iamobil'`);
                console.log(`  ✅ Coluna company_id adicionada a ${table}.`);
            } catch (e) {
                if (e.message.includes('duplicate column name')) {
                    console.log(`  ℹ️ Coluna company_id já existia em ${table}.`);
                } else {
                    throw e;
                }
            }

            // Atribuir iamobil para onde company_id está nulo ou vazio
            await db.execute(`UPDATE ${table} SET company_id = 'iamobil' WHERE company_id IS NULL OR company_id = ''`);
            console.log(`  ✅ Registros em ${table} vinculados a 'iamobil'.`);

        } catch (e) {
            console.error(`❌ Erro manipulando ${table}:`, e.message);
        }
    }
    
    // Tratativa específica para a tabela 'memory' por causa da mudança de 'key TEXT PRIMARY KEY' -> 'id PK + company_id'
    console.log(`\n[memory] Migrando tabela memory (mudança de chave primária)`);
    try {
        // Renomeia a tabela antiga
        await db.execute(`ALTER TABLE memory RENAME TO memory_old`);
        
        // Cria a nova tabela com a assinatura correta
        await db.execute(`
            CREATE TABLE memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL DEFAULT 'iamobil',
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, key)
            )
        `);
        
        // Transporta os dados
        await db.execute(`INSERT INTO memory (company_id, key, value, updated_at) SELECT 'iamobil', key, value, updated_at FROM memory_old`);
        
        // Exclui a antiga
        await db.execute(`DROP TABLE memory_old`);
        console.log(`  ✅ Nova tabela memory criada e dados migrados.`);
    } catch(e) {
        if(e.message.includes('no such table: memory')) {
            console.log(`  ℹ️ Tabela memory antiga não encontrada (provavelmente já foi migrada ou banco está zerado).`);
        } else {
            console.error(`❌ Erro migrando memory:`, e.message);
        }
    }

    // Criar a tabela crm_leads se ela não existir ainda
    console.log(`\n[crm_leads] Criando tabela CRM...`);
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS crm_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT NOT NULL,
                name TEXT,
                phone TEXT,
                email TEXT,
                source TEXT,
                status TEXT DEFAULT 'novo',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(`  ✅ Tabela crm_leads pronta.`);
    } catch (e) {
        console.error(`❌ Erro criando crm_leads:`, e.message);
    }

    console.log('\n🚀 Migração Multi-Tenant concluída com sucesso!');
    process.exit(0);
}

migrate();
