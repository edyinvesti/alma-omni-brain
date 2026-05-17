require('dotenv').config();
const https = require('https');
const { pipeline } = require('@xenova/transformers');
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const topics = [
    'inteligência artificial',
    'machine learning',
    'redes neurais artificiais',
    'deep learning',
    'cibersegurança',
    'criptografia',
    'startup',
    'empreendedorismo',
    'fintech',
    'criptomoeda bitcoin',
    ' Ethereum',
    'marketing redes sociais',
    'instagram marketing',
    'youtube marketing',
    'google ads',
    'facebook ads',
    'seo otimização',
    'copywriting',
    'funil vendas',
    ' CRM',
    'Gestão de projetos',
    'metodologia ágil',
    'scrum',
    'kanban',
    'excel',
    'power bi',
    'python',
    'javascript',
    'desenvolvimento web',
    'automação',
    'robôs',
    'iot internet das coisas',
    'big data',
    'data science',
    'analise de dados',
    'bitcoin',
    'ethereum blockchain'
];

let pipelineInstance = null;

async function getEmbedding(text) {
    if (!pipelineInstance) pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await pipelineInstance(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function wikipediaSearch(query) {
    return new Promise((resolve) => {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&limit=5`;
        https.get(url, { headers: { 'User-Agent': 'A.L.M.A./1.0 (Alma project)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data).query?.search || []); } catch { resolve([]); }
            });
        }).on('error', () => resolve([]));
    });
}

function wikipediaExtract(title) {
    return new Promise((resolve) => {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`;
        https.get(url, { headers: { 'User-Agent': 'A.L.M.A./1.0 (Alma project)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const pages = JSON.parse(data).query?.pages || {};
                    resolve(Object.values(pages)[0]?.extract || '');
                } catch { resolve(''); }
            });
        }).on('error', () => resolve(''));
    });
}

async function importTopic(topic) {
    console.log(`\n[WIKI] 🔍 ${topic}`);
    const results = await wikipediaSearch(topic);
    if (!results.length) return console.log(`[WIKI] Nenhum resultado`), 0;
    
    let imported = 0;
    for (const article of results.slice(0, 3)) {
        try {
            const content = await wikipediaExtract(article.title);
            if (content?.length > 50) {
                const embedding = await getEmbedding(content);
                await client.execute({
                    sql: `INSERT INTO knowledge (source, title, content, tags, embedding) VALUES (?, ?, ?, ?, ?)`,
                    args: ['Wikipedia', article.title, content.substring(0, 5000), topic, JSON.stringify(embedding)]
                });
                console.log(`   ✅ ${article.title}`);
                imported++;
                await delay(2000);
            }
        } catch (e) { console.log(`   ❌ erro`); }
    }
    return imported;
}

(async () => {
    console.log('[WIKI] Lote 2 - Importando...\n');
    let total = 0;
    for (const topic of topics) {
        total += await importTopic(topic);
        await delay(3000);
    }
    console.log(`\n[WIKI] Concluído! +${total} artigos.`);
})();