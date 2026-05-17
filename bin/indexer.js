const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function indexDirectory(directoryPath) {
    console.log(`[INDEXER] Iniciando indexação de: ${directoryPath}`);
    
    if (!fs.existsSync(directoryPath)) {
        console.error("[INDEXER] Erro: Pasta não encontrada.");
        return;
    }

    const files = fs.readdirSync(directoryPath);
    let count = 0;

    for (const file of files) {
        if (file.endsWith('.md')) {
            const filePath = path.join(directoryPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const title = file.replace('.md', '');

            try {
                // Insere ou atualiza o conhecimento no Turso
                await client.execute({
                    sql: 'INSERT INTO knowledge (source, title, content, last_indexed) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                    args: ['Obsidiana', title, content]
                });
                count++;
                console.log(`[INDEXER] ✅ Indexado: ${title}`);
            } catch (err) {
                console.error(`[INDEXER] ❌ Erro ao indexar ${file}:`, err.message);
            }
        }
    }

    console.log(`[INDEXER] Concluído! ${count} arquivos indexados.`);
}

// Pega o caminho dos argumentos ou do .env
const targetPath = process.argv[2] || process.env.OBSIDIAN_PATH;
if (targetPath) {
    indexDirectory(targetPath);
} else {
    console.log("[INDEXER] Uso: node indexer.js C:\\caminho\\do\\obsidian");
}
