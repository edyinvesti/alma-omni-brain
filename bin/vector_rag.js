require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

let embeddingPipeline = null;

async function getEmbedding(text) {
    if (!embeddingPipeline) {
        const { pipeline } = await import('@xenova/transformers');
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    
    const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function initVectorTable() {
    console.log('[VECTOR] Verificando coluna de embeddings...');
    try {
        await client.execute(`ALTER TABLE knowledge ADD COLUMN embedding BLOB`);
        console.log('[VECTOR] Coluna embedding adicionada!');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('[VECTOR] Coluna já existe.');
        } else {
            console.log('[VECTOR] Erro:', err.message);
        }
    }
}

async function addKnowledgeWithEmbedding(source, title, content, tags = '') {
    console.log(`[VECTOR] Gerando embedding para: ${title}`);
    const embedding = await getEmbedding(`${title}. ${content}`);
    
    await client.execute({
        sql: `INSERT INTO knowledge (source, title, content, tags, embedding) VALUES (?, ?, ?, ?, ?)`,
        args: [source, title, content, tags, JSON.stringify(embedding)]
    });
    
    console.log(`[VECTOR] Salvo! Dimensões: ${embedding.length}`);
}

async function searchSimilar(query, topK = 5) {
    console.log(`[VECTOR] Buscando: "${query}"`);
    const queryEmbedding = await getEmbedding(query);
    
    const results = await client.execute({
        sql: `SELECT id, source, title, content, tags, embedding FROM knowledge`,
        args: []
    });
    
    if (!results.rows || results.rows.length === 0) {
        return [];
    }
    
    const scored = results.rows.map(row => {
        let embedding = null;
        try {
            embedding = JSON.parse(row.embedding || '[]');
        } catch (e) {}
        
        if (!embedding || embedding.length === 0) {
            return { ...row, score: 0 };
        }
        
        const score = cosineSimilarity(queryEmbedding, embedding);
        return { ...row, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

module.exports = { initVectorTable, addKnowledgeWithEmbedding, searchSimilar, getEmbedding };

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        const command = args[0];
        
        if (command === 'init') {
            await initVectorTable();
        } else if (command === 'add') {
            const source = args[1] || 'Manual';
            const title = args[2] || 'Teste';
            const content = args.slice(3).join(' ');
            if (content) {
                await addKnowledgeWithEmbedding(source, title, content);
            } else {
                console.log('Uso: node vector_rag.js add <source> <title> <content>');
            }
        } else if (command === 'search') {
            const query = args.slice(1).join(' ');
            if (query) {
                const results = await searchSimilar(query);
                console.log('\n=== RESULTADOS ===');
                results.forEach((r, i) => {
                    console.log(`${i+1}. ${r.title} (score: ${r.score.toFixed(3)})`);
                    console.log(`   ${r.content.substring(0, 150)}...\n`);
                });
            } else {
                console.log('Uso: node vector_rag.js search <query>');
            }
        } else {
            console.log('Comandos: init | add <source> <title> <content> | search <query>');
        }
    })();
}