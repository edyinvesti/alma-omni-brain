const { exec } = require('child_process');

// Script para injetar um ping via curl diretamente na interface do servidor para ver se o cérebro recebe mensagens via MCP (chamando o endpoint /api/brain que é a bridge local)
const http = require('http');

console.log("=== INICIANDO TESTE ALMA SYNAPSE ===");

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/brain',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-alma-key': 'alma_secret_2026'
    }
}, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log("\n✅ RESPOSTA DA A.L.M.A:\n", parsed.cleanText || parsed.response);
            console.log("\n[TESTE CONCLUÍDO COM SUCESSO]");
        } catch(e) {
            console.log("\n❌ ERRO NO RETORNO:", data);
        }
    });
});

req.on('error', (e) => {
    console.log("\n❌ SERVIDOR OFFLINE OU ERRO DE REDE:", e.message);
});

console.log("Enviando requisição (Pergunta: Quem é o responsável por você e qual o seu nome?)...");
req.write(JSON.stringify({ prompt: "Quem é o responsável por você e qual o seu nome?" }));
req.end();
