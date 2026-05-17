const http = require('http');

const data = JSON.stringify({ prompt: 'o que é machine learning?' });

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/brain',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-alma-key': 'alma_secret_2026'
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});

req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();