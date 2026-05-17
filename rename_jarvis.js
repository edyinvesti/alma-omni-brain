const fs = require('fs');
const path = require('path');

const directories = [
    path.join(__dirname, 'src'),
    path.join(__dirname, 'public')
];

function processFile(filePath) {
    if (!filePath.endsWith('.js') && !filePath.endsWith('.html') && !filePath.endsWith('.css')) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // We avoid renaming require('jarvis...') or paths if possible, but "jarvis.html" might be an issue.
    // The safest is to target specific phrases or case-sensitive variables.
    
    // Replace standalone Jarvis references
    content = content.replace(/Jarvis/g, 'Alma');
    content = content.replace(/JARVIS/g, 'ALMA');
    content = content.replace(/jarvis_secure_key/g, 'alma_secure_key');
    // For System prompt specifically
    content = content.replace(/Você é o JARVIS/g, 'Você é a ALMA');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Updated:', filePath);
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

directories.forEach(dir => processDirectory(dir));
console.log('Done replacing in JS and public files.');
