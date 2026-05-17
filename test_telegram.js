const https = require('https');

const token = '8518348277:AAE3ltxflQO7yYpapB_yGF25HfnTEaxpaXo';
const chatId = '6202370881';
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