const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'jarvis');

function processFile(filePath) {
    if (!filePath.endsWith('.py')) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    content = content.replace(/Jarvis/g, 'Alma');
    content = content.replace(/JARVIS/g, 'ALMA');
    content = content.replace(/jarvis_secure_key/g, 'alma_secure_key');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Updated:', filePath);
    }
}

function processDirectory(d) {
    const files = fs.readdirSync(d);
    for (const file of files) {
        const fullPath = path.join(d, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== '__pycache__' && file !== 'logs') {
                processDirectory(fullPath);
            }
        } else {
            processFile(fullPath);
        }
    }
}

processDirectory(dir);
console.log('Done replacing in python scripts.');
