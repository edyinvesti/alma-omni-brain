const { EventEmitter } = require('events');

class ActionQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.concurrency = 2;
        this.running = 0;
        this.maxRetries = 10;

        this.stats = {
            processed: 0,
            failed: 0,
            totalTime: 0
        };
    }

    // ✅ NOV0: Adiciona ação à fila
    async add(action, priority = 5) {
        return new Promise((resolve, reject) => {
            const job = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                action,
                priority, // 1 = alta, 10 = baixa
                created: Date.now(),
                attempts: 0,
                maxAttempts: 3,
                resolve,
                reject
            };

            this.queue.push(job);
            this.queue.sort((a, b) => a.priority - b.priority);
            
            console.log(`[FILA] Ação adicionada: ${action.type} (Prioridade: ${priority}, Fila: ${this.queue.length})`);
            
            this.process();
        });
    }

    // ✅ NOV0: Processa a fila
    async process() {
        if (this.processing || this.running >= this.concurrency) {
            return;
        }

        if (this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.running < this.concurrency) {
            const job = this.queue.shift();
            this.running++;
            
            this.executeJob(job).finally(() => {
                this.running--;
                this.process();
            });
        }

        this.processing = false;
    }

    async executeJob(job) {
        const startTime = Date.now();

        try {
            console.log(`[FILA] Executando: ${job.action.type} (Tentativa ${job.attempts + 1})`);

            const result = await this.executeAction(job.action);

            this.stats.processed++;
            this.stats.totalTime += Date.now() - startTime;

            console.log(`[FILA] ✅ Concluído: ${job.action.type} (${Date.now() - startTime}ms)`);
            job.resolve(result);

            this.emit('completed', { job, result });

        } catch (error) {
            job.attempts++;

            const totalRetries = this.queue.filter(j => j.attempts > 0).length;
            if (job.attempts < job.maxAttempts && totalRetries < this.maxRetries) {
                console.log(`[FILA] ⚠️ Erro, tentando novamente: ${error.message}`);
                this.queue.unshift(job);
                setTimeout(() => this.process(), 1000);
            } else {
                this.stats.failed++;
                console.log(`[FILA] ❌ Falhou definitivamente: ${job.action.type}`);
                job.reject(error);
                this.emit('failed', { job, error });
            }
        }
    }

    async executeAction(action) {
        const { execSync } = require('child_process');
        
        switch (action.type) {
            case 'open_app':
                return this.openApplication(action.target);
                
            case 'open_url':
                return this.openURL(action.target);
                
            case 'command':
                return this.runCommand(action.command);
                
            case 'search':
                return this.webSearch(action.query);
                
            case 'speak':
                return this.speakText(action.target || action.text || action.value);
                
            default:
                throw new Error(`Tipo de ação desconhecido: ${action.type}`);
        }
    }

    async speakText(text) {
        if (!text) return { success: false, error: 'Texto para fala não fornecido.' };
        
        const { exec } = require('child_process');
        const sanitized = text.replace(/'/g, "''").replace(/"/g, '\"');
        const command = `PowerShell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${sanitized}')"`;
        
        console.log(`[TTS] Falando: ${text}`);
        
        return new Promise((resolve) => {
            exec(command, (error) => {
                if (error) {
                    console.error(`[TTS] Erro: ${error.message}`);
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }
    async openApplication(name) {
        const AppFinder = require('./app_finder');
        return await AppFinder.openApp(name);
    }

    async openURL(url) {
        const { execSync } = require('child_process');
        const fullUrl = url.startsWith('http') ? url : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        execSync(`start "" "${fullUrl}"`, { shell: 'cmd' });
        return { success: true, url: fullUrl };
    }

    async runCommand(command) {
        // [SECURITY PATCH] RCE BLOCKED
        // Executar comandos arbitrários no sistema operacional direto por string é uma vulnerabilidade fatal (Command Injection).
        console.warn(`[SECURITY] Tentativa bloqueada de executar comando arbitrário: ${command}`);
        return { success: false, output: "Bloqueado pelo Protocolo de Segurança: Não é permitido invocar comandos de shell arbitrários." };
    }

    async webSearch(query) {
        const { execSync } = require('child_process');
        execSync(`start "" "https://www.google.com/search?q=${encodeURIComponent(query)}"`, { shell: 'cmd' });
        return { success: true, query };
    }

    // ✅ NOV0: Status da fila
    getStatus() {
        return {
            queueLength: this.queue.length,
            running: this.running,
            concurrency: this.concurrency,
            stats: this.stats
        };
    }

    // ✅ NOV0: Limpa a fila
    clear() {
        const count = this.queue.length;
        this.queue = [];
        console.log(`[FILA] Limpa: ${count} ações removidas`);
        return count;
    }
}

// Singleton
module.exports = new ActionQueue();