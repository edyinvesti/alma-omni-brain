const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AppFinder {
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutos
    }

    // ✅ NOV0: Busca apps no Menu Iniciar do Windows
    async findInstalledApps() {
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheDuration) {
            return this.cache;
        }

        const apps = new Map();
        
        // Buscar em vários locais do Windows
        const searchPaths = [
            process.env.APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs',
            'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
            process.env.USERPROFILE + '\\Desktop'
        ];

        for (const searchPath of searchPaths) {
            try {
                await this.scanDirectory(searchPath, apps);
            } catch (e) {
                // Ignora erros de permissões
            }
        }

        // Também busca apps do sistema
        try {
            const result = execSync('powershell -Command "Get-StartApps | Select-Object -First 100 | ConvertTo-Json"', { encoding: 'utf8', timeout: 10000 });
            const startApps = JSON.parse(result);
            if (Array.isArray(startApps)) {
                startApps.forEach(app => {
                    if (app.Name && app.AppID) {
                        apps.set(app.Name.toLowerCase(), { name: app.Name, appid: app.AppID });
                    }
                });
            }
        } catch (e) {
            // Ignora
        }

        this.cache = apps;
        this.cacheTime = now;
        return apps;
    }

    async scanDirectory(dir, apps, depth = 0) {
        if (depth > 3) return;
        
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    await this.scanDirectory(fullPath, apps, depth + 1);
                } else if (item.endsWith('.lnk')) {
                    const name = item.replace('.lnk', '').toLowerCase();
                    apps.set(name, { name: item.replace('.lnk', ''), path: fullPath });
                }
            }
        } catch (e) {
            // Sem permissão
        }
    }

    // ✅ NOV0: Encontra o melhor app para o que o usuário quer
    async findBestApp(query) {
        const apps = await this.findInstalledApps();
        const queryLower = query.toLowerCase();
        
        // Procura exata primeiro
        if (apps.has(queryLower)) {
            return apps.get(queryLower);
        }

        // Procura parcial
        let matches = [];
        for (const [key, app] of apps) {
            if (key.includes(queryLower) || queryLower.includes(key)) {
                matches.push({ score: key.length, app });
            }
        }

        // Ordena por relevância
        matches.sort((a, b) => a.score - b.score);
        
        return matches.length > 0 ? matches[0].app : null;
    }

    // ✅ NOV0: Abre app encontrado
    async openApp(appName) {
        const app = await this.findBestApp(appName);
        
        if (!app) {
            // Procura no Windows Search como fallback
            try {
                execSync(`start shell:AppsFolder\\${appName}`, { shell: 'cmd' });
                return { success: true, method: 'shell:AppsFolder', app: appName };
            } catch (e) {
                return { success: false, error: 'App não encontrado' };
            }
        }

        if (app.appid) {
            // Usa Start App do Windows
            try {
                execSync(`powershell -Command "Start-Process shell:AppsFolder\\${app.appid}"`, { shell: 'cmd' });
                return { success: true, method: 'StartApps', app: app.name };
            } catch (e) {
                // Fallback
            }
        }

        if (app.path) {
            try {
                execSync(`start "" "${app.path}"`, { shell: 'cmd' });
                return { success: true, method: 'lnk', app: app.name };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        return { success: false, error: 'Método não encontrado' };
    }
}

module.exports = new AppFinder();