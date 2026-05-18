const https = require('https');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
    console.error('[TEST] ERRO: TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID devem estar no .env');
    process.exit(1);
}
const message = 'oi';

const body = JSON.stringify({
    chat_id: chatId,
    text: message
});

const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(data);
    });
});

req.write(body);
req.end();