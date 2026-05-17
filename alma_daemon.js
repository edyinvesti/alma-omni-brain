const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.clear();
console.log("==========================================");
console.log("  INICIANDO ALMA CENTRAL ORCHESTRATOR");
console.log("==========================================");

const processes = [];

// Função para iniciar um módulo robustamente
function startModule(name, command, args, cwd) {
    const proc = spawn(command, args, {
        cwd: cwd,
        stdio: 'pipe',
        shell: false
    });

    proc.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
    proc.stderr.on('data', (data) => process.stderr.write(`[${name} ERROR] ${data}`));

    proc.on('close', (code) => {
        console.log(`[ALERTA] ${name} foi encerrado e desconectado da ramificação (Código ${code}).`);
    });

    processes.push(proc);
    console.log(`[+] Módulo ${name} iniciado com sucesso (PID: ${proc.pid})`);
    return proc;
}

const rootPath = __dirname;
let almaPath = path.join(rootPath, 'alma');
if (!fs.existsSync(almaPath)) almaPath = path.join(rootPath, 'jarvis');

// Inicia os processos filho (O Nó cérebro, Automação do Hermes e Lógica de Python)
startModule("Alma_Node", "node", ["src/server.js"], rootPath);
startModule("ALMA_Core_Py", "python", ["main.py"], almaPath);
startModule("Hermes_Py", "python", ["automation/hermes_server.py"], almaPath);

// Sistema de Auto-Limpeza Anti-Ghost Processes
// Caso este Launcher morra (Control+C, fechamento terminal ou falha fatal), nós assassinos todos os filhos
function gracefulShutdown() {
    console.log("\n==========================================");
    console.log("  ENCERRANDO TODOS OS MÓDULOS ALMA (SIGINT)");
    console.log("==========================================");
    
    processes.forEach(proc => {
        if (!proc.killed) {
            console.log(`[-] Matando processo órfão ${proc.pid}...`);
            // Em windows 'kill' não funciona 100% no cmd shell, utilizamos o taskkill para derrubar forçadamente o galho da árvore do processo.
            if (process.platform === 'win32') {
                spawn("taskkill", ["/pid", proc.pid, '/f', '/t']);
            } else {
                proc.kill('SIGKILL');
            }
        }
    });

    setTimeout(() => {
        console.log("[STATUS] Limpeza Concluída. Nenhum processo fantasma deixado para trás.");
        process.exit(0);
    }, 1000);
}

// Interceptadores de Sinal do SO
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('exit', () => {
    // Fail-safe the shutdown on sync exit just in case
    processes.forEach(proc => {
        try {
            if (!proc.killed && process.platform === 'win32') {
                spawn("taskkill", ["/pid", proc.pid, '/f', '/t']);
            } else {
                 proc.kill('SIGKILL');
            }
        } catch (e) {}
    });
});
