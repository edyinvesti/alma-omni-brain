require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const screenshotPath = 'C:\\Users\\User\\Downloads\\JARVIS_screenshot_20260517_181446.png';

const form = new FormData();
form.append('chat_id', chatId);
form.append('photo', fs.createReadStream(screenshotPath));
form.append('caption', '📸 Screenshot capturada pelo Jarvis!');

const options = {
    hostname: 'api.telegram.org',
    path: `/bot${botToken}/sendPhoto`,
    method: 'POST',
    headers: form.getHeaders()
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok) {
            console.log('📸 Screenshot enviada para o Telegram!');
        } else {
            console.log('Erro:', result);
        }
    });
});

form.pipe(req);
req.on('error', e => console.error('Erro:', e));