const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function addTestKnowledge() {
    try {
        await client.execute({
            sql: 'INSERT INTO knowledge (source, title, content) VALUES (?, ?, ?)',
            args: ['Manual Site 7', 'Servidor do Site 7', 'O Site 7 de suplementos está rodando em um servidor dedicado da HostGator no Texas, usando banco MySQL.']
        });
        console.log("[TEST] Conhecimento de teste inserido no Turso.");
    } catch (err) {
        console.error("[TEST] Erro:", err.message);
    }
}

addTestKnowledge();
