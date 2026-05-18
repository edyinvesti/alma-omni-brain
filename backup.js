require('dotenv').config();
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
const RETENTION_DAYS = 7;

async function createBackup() {
    console.log('[BACKUP] Iniciando backup...');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url || !token) {
        console.error('[BACKUP] ERRO: TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN não configurados no .env');
        process.exit(1);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const client = createClient({ url, authToken: token });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `alma_backup_${timestamp}.json`);

    const tables = ['history', 'memory', 'knowledge', 'logs', 'actions'];
    const backup = { created_at: new Date().toISOString(), database: url, tables: {} };

    for (const table of tables) {
        try {
            const result = await client.execute(`SELECT * FROM ${table}`);
            backup.tables[table] = result.rows;
            console.log(`[BACKUP] ${table}: ${result.rows.length} registros`);
        } catch (e) {
            console.warn(`[BACKUP] Erro ao backup ${table}: ${e.message}`);
            backup.tables[table] = [];
        }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`[BACKUP] Salvo em: ${backupFile}`);

    await cleanupOldBackups();
    console.log('[BACKUP] Concluido com sucesso!');
    process.exit(0);
}

async function cleanupOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('alma_backup_') && f.endsWith('.json'))
        .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

    const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    for (const file of files) {
        if (file.mtime < cutoff) {
            fs.unlinkSync(file.path);
            console.log(`[BACKUP] Excluido backup antigo: ${file.name}`);
        }
    }
}

createBackup().catch(e => {
    console.error('[BACKUP] ERRO:', e.message);
    process.exit(1);
});