require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function getEmbedding(text) {
    const { pipeline } = await import('@xenova/transformers');
    const p = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await p(text, { pooling: 'mean', normalize: true });
    return JSON.stringify(Array.from(output.data));
}

async function generateEmbeddings() {
    const r = await client.execute('SELECT id, title, content FROM knowledge WHERE embedding IS NULL');

    for (const row of r.rows) {
        const embedding = await getEmbedding(row.content);
        await client.execute('UPDATE knowledge SET embedding = ? WHERE id = ?', [embedding, row.id]);
        console.log(`✅ Embedding gerado: ${row.title}`);
    }

    console.log(`\n🎉 ${r.rows.length} embeddings gerados!`);
}

generateEmbeddings();