require('dotenv').config();
const { createClient } = require('@libsql/client');
const c = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
    // Remove duplicatas, mantendo apenas o mais recente
    await c.execute(`
        DELETE FROM knowledge 
        WHERE source = 'Obsidiana' 
        AND rowid NOT IN (
            SELECT MAX(rowid) 
            FROM knowledge 
            WHERE source = 'Obsidiana' 
            GROUP BY title
        )
    `);
    console.log("✅ Duplicatas removidas!");

    // Remove entradas vazias
    await c.execute('DELETE FROM knowledge WHERE source = ? AND length(content) < 10', ['Obsidiana']);
    console.log("✅ Entradas vazias removidas!");

    // Mostra resultado
    const r = await c.execute('SELECT source, title, substr(content, 1, 300) as content FROM knowledge WHERE source=?', ['Obsidiana']);
    console.log(JSON.stringify(r.rows, null, 2));
}
main();