const Database = require('./database');

let pipeline = null;

async function getEmbedding(text) {
    if (!pipeline) {
        const { pipeline: p } = await import('@xenova/transformers');
        pipeline = await p('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await pipeline(text, { pooling: 'mean', normalize: true });
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

async function searchKnowledge(query, topK = 5) {
    try {
        await Database.connect();
        const queryEmbedding = await getEmbedding(query);

        const results = await Database.client.execute({
            sql: `SELECT id, source, title, content, embedding FROM knowledge WHERE embedding IS NOT NULL`,
            args: []
        });
        
        if (!results.rows || results.rows.length === 0) {
            return [];
        }
        
        const scored = results.rows.map(row => {
            let embedding = null;
            try {
                embedding = JSON.parse(row.embedding || '[]');
            } catch (e) { console.warn('[VECTOR] Erro parsing embedding:', e.message); }
            
            if (!embedding || embedding.length === 0) {
                return { ...row, score: 0 };
            }
            
            const score = cosineSimilarity(queryEmbedding, embedding);
            return { ...row, score };
        });
        
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).filter(r => r.score > 0.1);
    } catch (err) {
        console.error('[VECTOR SEARCH] Erro:', err.message);
        return [];
    }
}

module.exports = { searchKnowledge, getEmbedding };