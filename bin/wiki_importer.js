require('dotenv').config();
const https = require('https');
const { pipeline } = require('@xenova/transformers');
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function getEmbedding(text) {
    const p = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await p(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function wikipediaSearch(query) {
    return new Promise((resolve, reject) => {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&limit=3`;
        const req = https.get(url, { headers: { 'User-Agent': 'A.L.M.A./1.0 (Alma project)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.query?.search || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
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
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function importWikipedia(topic, maxArticles = 5) {
    console.log(`[WIKI] Buscando sobre: ${topic}`);
    
    const results = await wikipediaSearch(topic);
    console.log(`[WIKI] Encontrados ${results.length} artigos`);
    
    let imported = 0;
    for (const article of results.slice(0, maxArticles)) {
        console.log(`[WIKI] Importando: ${article.title}...`);
        
        const content = await wikipediaExtract(article.title);
        if (content && content.length > 50) {
            const embedding = await getEmbedding(content);
            
            await client.execute({
                sql: `INSERT INTO knowledge (source, title, content, tags, embedding) VALUES (?, ?, ?, ?, ?)`,
                args: ['Wikipedia', article.title, content.substring(0, 5000), topic, JSON.stringify(embedding)]
            });
            
            console.log(`[WIKI] ✅ ${article.title} (${content.length} chars)`);
            imported++;
        }
    }
    
    console.log(`[WIKI] Importados ${imported} artigos sobre "${topic}"`);
}

if (require.main === module) {
    const topic = process.argv.slice(2).join(' ') || 'Bitcoin';
    importWikipedia(topic);
}