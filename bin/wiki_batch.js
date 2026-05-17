require('dotenv').config();
const https = require('https');
const { pipeline } = require('@xenova/transformers');
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const topics = [
    'marketing digital',
    'e-commerce',
    'vendas',
    'dropshipping',
    'imóveis',
    'ações bolsa de valores',
    'forex trading',
    'inteligência artificial',
    'machine learning',
    'programação python',
    'redes neurais',
    'cibersegurança',
    'academia',
    'nutrição esportiva',
    'hipertrofia',
    'emagrecimento',
    'filosofia',
    'história',
    'economia'
];

let pipelineInstance = null;

async function getEmbedding(text) {
    if (!pipelineInstance) {
        pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await pipelineInstance(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function wikipediaSearch(query) {
    return new Promise((resolve, reject) => {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&limit=5`;
        const req = https.get(url, { headers: { 'User-Agent': 'A.L.M.A./1.0 (Alma project)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.query?.search || []);
                } catch (e) {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

function wikipediaExtract(title) {
    return new Promise((resolve, reject) => {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`;
        const req = https.get(url, { headers: { 'User-Agent': 'A.L.M.A./1.0 (Alma project)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const pages = parsed.query?.pages || {};
                    const page = Object.values(pages)[0];
                    resolve(page?.extract || '');
                } catch (e) {
                    resolve('');
                }
            });
        }).on('error', () => resolve(''));
    });
}

async function importTopic(topic) {
    console.log(`\n[WIKI] 🔍 ${topic}`);
    
    const results = await wikipediaSearch(topic);
    if (results.length === 0) {
        console.log(`[WIKI] Nenhum resultado para: ${topic}`);
        return 0;
    }
    
    let imported = 0;
    for (const article of results.slice(0, 3)) {
        try {
            const content = await wikipediaExtract(article.title);
            if (content && content.length > 50) {
                const embedding = await getEmbedding(content);
                
                await client.execute({
                    sql: `INSERT INTO knowledge (source, title, content, tags, embedding) VALUES (?, ?, ?, ?, ?)`,
                    args: ['Wikipedia', article.title, content.substring(0, 5000), topic, JSON.stringify(embedding)]
                });
                
                console.log(`   ✅ ${article.title}`);
                imported++;
                await delay(2000);
            }
        } catch (e) {
            console.log(`   ❌ ${article.title}: erro`);
        }
    }
    
    return imported;
}

async function main() {
    console.log('[WIKI] Iniciando importação em lote...\n');
    let total = 0;
    
    for (const topic of topics) {
        const count = await importTopic(topic);
        total += count;
        await delay(3000);
    }
    
    console.log(`\n[WIKI] Concluído! Total de ${total} artigos importados.`);
}

main();