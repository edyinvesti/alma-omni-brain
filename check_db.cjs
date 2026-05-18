require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function check() {
    console.log('=== MEMÓRIA ===');
    const mem = await client.execute("SELECT COUNT(*) as total FROM memory");
    console.log('Itens:', mem.rows[0].total);

    const memRec = await client.execute("SELECT key, value FROM memory ORDER BY ROWID DESC LIMIT 5");
    memRec.rows.forEach(r => console.log(`  ${r.key}: ${r.value.substring(0, 40)}`));

    console.log('\n=== KNOWLEDGE (Obsidian) ===');
    const know = await client.execute("SELECT COUNT(*) as total FROM knowledge");
    console.log('Notas indexadas:', know.rows[0].total);

    const knowRec = await client.execute("SELECT source, title FROM knowledge ORDER BY ROWID DESC LIMIT 3");
    knowRec.rows.forEach(r => console.log(`  [${r.source}] ${r.title}`));

    console.log('\n=== ACTIONS ===');
    const acts = await client.execute("SELECT COUNT(*) as total FROM actions");
    console.log('Pendentes:', acts.rows[0].total);

    process.exit();
}

check();