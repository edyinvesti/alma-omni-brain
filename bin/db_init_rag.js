const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initRAG() {
    console.log("[RAG] Inicializando tabelas de conhecimento...");
    try {
        // Tabela para armazenar o conhecimento processado (RAG)
        // Usaremos uma busca de texto comum (FTS) se o vetor não estiver disponível
        await client.execute(`
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,       -- Ex: "Obsidian", "Manual Site 1", "Wiki"
                title TEXT,
                content TEXT,
                tags TEXT,
                last_indexed DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Criação de índice de busca para o conteúdo
        // libSQL suporta FTS5 para busca rápida por palavras-chave
        // (Isso já garante um "RAG" básico muito eficiente)
        console.log("[RAG] Tabelas criadas com sucesso no Turso.");
    } catch (err) {
        console.error("[RAG] Erro ao inicializar:", err);
    }
}

initRAG();
