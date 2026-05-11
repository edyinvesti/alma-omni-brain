require('dotenv').config();
const { createClient } = require('@libsql/client');

async function checkLogs() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url || !token) {
        console.error("Erro: Credenciais Turso não encontradas no .env");
        return;
    }

    const client = createClient({ url, authToken: token });
    try {
        const res = await client.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 10");
        console.log("=== ÚLTIMOS 10 LOGS (TURSO) ===");
        console.table(res.rows);
    } catch (e) {
        console.error("Erro ao consultar Turso:", e.message);
    }
}

checkLogs();
