const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const TELEGRAM_TOKEN = '8518348277:AAE3ltxflQO7yYpapB_yGF25HfnTEaxpaXo';
const TELEGRAM_CHAT = '6202370881';
const screenshotPath = 'C:\\Users\\User\\Downloads\\jarvis.html\\screenshot.png';

console.log('📸 Capturando screenshot...');

try {
    execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Width, $_.Height); $gfx = [System.Drawing.Graphics]::FromImage($bmp); $gfx.CopyFromScreen($_.X, $_.Y, 0, 0, $_.Size); $bmp.Save('${screenshotPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png); $gfx.Dispose(); $bmp.Dispose() }"`, { encoding: 'utf8', timeout: 10000 });
    console.log('✅ Screenshot capturado');
} catch (e) {
    console.log('⚠️ Erro no screenshot:', e.message);
    process.exit(1);
}

console.log('📤 Enviando ao Telegram...');

function sendPhoto() {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const fileData = fs.readFileSync(screenshotPath);
    
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="chat_id";\r\n\r\n${TELEGRAM_CHAT}\r\n`),
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="photo"; filename="screenshot.png"\r\n`),
        Buffer.from('Content-Type: image/png\r\n\r\n'),
        fileData,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body)
        }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const result = JSON.parse(data);
            if (result.ok) {
                console.log('✅ Foto enviada ao Telegram!');
            } else {
                console.log('❌ Erro:', result.description);
            }
        });
    });

    req.on('error', (e) => {
        console.log('❌ Erro na requisição:', e.message);
    });

    req.write(body);
    req.end();
}

sendPhoto();