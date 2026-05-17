const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir);

for (const file of files) {
    if ((file.endsWith('.bat') || file.endsWith('.ps1')) && !fs.statSync(path.join(dir, file)).isDirectory()) {
        const fullPath = path.join(dir, file);
        let content = fs.readFileSync(fullPath, 'utf-8');
        let original = content;

        content = content.replace(/Jarvis/g, 'Alma');
        content = content.replace(/JARVIS/g, 'ALMA');
        content = content.replace(/Um assistente de IA/g, 'Uma assistente de IA');

        if (content !== original) {
            fs.writeFileSync(fullPath, content, 'utf-8');
            console.log('Updated:', fullPath);
        }
    }
}
console.log('Done replacing in root scripts.');
