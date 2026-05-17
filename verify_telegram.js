const { createClient } = require('@libsql/client');
require('dotenv').config();

async function verify() {
    console.log('--- DIAGNÓSTICO ALMA CORE ---');
    
    // 1. Verificar Token do Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
    } else {
        console.log('✅ Token detectado:', token.substring(0, 10) + '...');
        try {
            const botInfo = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
            if (botInfo.ok) {
                console.log(`✅ Bot está ONLINE: @${botInfo.result.username}`);
            } else {
                console.error('❌ Token Inválido ou Bot Offline:', botInfo.description);
            }
        } catch (e) {
            console.error('❌ Erro ao conectar na API do Telegram:', e.message);
        }
    }

    // 2. Verificar Turso e Logs
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (!url || !authToken) {
        console.error('❌ Turso não configurado corretamente.');
    } else {
        const client = createClient({ url, authToken });
        try {
            const res = await client.execute('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5');
            console.log('\n--- ÚLTIMOS LOGS (TURSO) ---');
            res.rows.forEach(row => {
                console.log(`[${row.timestamp}] [${row.source}] ${row.message}`);
            });
        } catch (e) {
            console.error('❌ Erro ao consultar logs no Turso:', e.message);
        }
    }
    
    // 3. Verificar Groq
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        console.error('❌ GROQ_API_KEY não encontrada.');
    } else {
        console.log('✅ Groq Key detectada:', groqKey.substring(0, 10) + '...');
    }
}

verify();
