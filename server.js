require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const { createClient } = require('@libsql/client');

// Chave Groq para Whisper e Chat
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY || "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";

// Detecta modo Nuvem
const IS_CLOUD = process.env.CLOUD_MODE === 'true' || !!process.env.RENDER;

// Inicializa o Bot do Telegram se o token existir
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
let bot = null;

if (botToken && !botToken.includes("insira_seu_token")) {
    bot = new TelegramBot(botToken, { polling: true });
    
    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 A.L.M.A. Core Online.\nTodos os sistemas estão operacionais.");
    });
    
    bot.onText(/\/ping/, (msg) => {
        bot.sendMessage(msg.chat.id, "🏓 Pong. Conexão neural estável.");
    });

    bot.on('message', (msg) => {
        console.log(`\n=======================================\n[RASTREADOR] O seu Chat ID Secreto é: ${msg.chat.id}\n=======================================\n`);
    });

    console.log('[TELEGRAM] Bot C2 Inicializado, aguardando comandos.');
} else {
    console.log('[TELEGRAM] Aviso: Token não configurado no .env. Alertas desativados.');
}

// --- GLOBAL ERROR HANDLERS ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO FATAL] Rejeição não tratada:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[ERRO FATAL] Exceção não tratada:', err);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Relax CSP for Neural Interface
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';");
    next();
});

// --- MIDDLEWARE DE SEGURANÇA SENTINEL ---
const API_SECRET = process.env.API_SECRET || "alma_secret_2026";

const securityMiddleware = (req, res, next) => {
    const incomingSecret = req.headers['x-alma-key'];
    console.log(`[SENTINEL DEBUG] Recebi chave: "${incomingSecret}" (Esperado: "${API_SECRET}")`);
    if (incomingSecret !== API_SECRET) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.warn(`[SENTINEL] Tentativa de acesso não autorizado! IP: ${ip} para ${req.path}`);
        
        // Loga no banco como alerta de segurança
        dbExecute('INSERT INTO logs (source, message) VALUES (?, ?)', ['SENTINEL', `ALERTA: Tentativa de acesso não autorizado no endpoint ${req.path} vindo do IP ${ip}`])
            .catch(err => console.error("Falha ao salvar log de segurança", err));

        if (bot && adminChatId) {
            bot.sendMessage(adminChatId, `🚨 [ALERTA SENTINEL]\nTentativa de invasão detectada!\nIP: ${ip}\nEndpoint: ${req.path}`);
        }
        return res.status(403).json({ error: 'Acesso negado pelo protocolo Sentinel.' });
    }
    next();
};

app.use(express.static(__dirname)); // Serve os arquivos estáticos

// --- CONFIGURAÇÃO DO BANCO DE DADOS (TURSO CLOUD) ---
let db_type = "cloud";
let db = null;

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (TURSO_URL && TURSO_TOKEN) {
    db = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN
    });
    db_type = "cloud";
    console.log('[SISTEMA] Conectado ao banco Turso (Nuvem).');
} else {
    console.error('[ERRO FATAL] Variáveis TURSO_DATABASE_URL e TURSO_AUTH_TOKEN não configuradas!');
    console.error('[SISTEMA] Configure as variáveis de ambiente no Render e o sistema vai rodar 100% Cloud.');
    process.exit(1);
}

// --- HELPER UNIFICADO PARA CONSULTAS (LOCAL E NUVEM) ---
async function dbExecute(sql, params = []) {
    if (db_type === "cloud") {
        return await db.execute({ sql, args: params });
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }
}

// Inicializa a tabela logs em ambos os modos (Local e Nuvem)
dbExecute('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)')
    .then(() => console.log('[SISTEMA] Tabela logs inicializada/verificada.'))
    .catch(err => console.error('[ERRO] Tabela logs:', err));


async function dbGet(sql, params = []) {
    if (db_type === "cloud") {
        const res = await db.execute({ sql, args: params });
        return res.rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

app.get('/', (req, res) => {
    res.send('A.L.M.A. Core API Online');
});

// Endpoint de Saúde para o Sentinel
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), system: 'A.L.M.A. Core' });
});

// Endpoint principal para injetar dados das outras plataformas (Protegido)
app.post('/api/telemetry', securityMiddleware, async (req, res) => {
    const { source, message } = req.body;
    if (!source || !message) return res.status(400).json({ error: 'Faltando "source" ou "message"' });

    try {
        const result = await dbExecute('INSERT INTO logs (source, message) VALUES (?, ?)', [source, message]);
        const lastID = result.lastInsertRowid || result.insertId;
        const timestamp = new Date().toISOString();
        
        // Dispara o evento via WebSockets para o dashboard
        io.emit('new_log', { id: lastID, source, message, timestamp });
        
        // Dispara notificação via Telegram se configurado
        if (bot && adminChatId && !adminChatId.includes("insira_seu_chat_id")) {
            bot.sendMessage(adminChatId, `📡 [ALERTA OMNI-BRAIN]\nOrigem: ${source}\nMensagem: ${message}`);
        }
        
        console.log(`[LOG] Novo evento registrado: ${source} - ${message}`);
        res.json({ success: true, id: lastID });
    } catch (err) {
        console.error("[ERRO DB] Falha na telemetria:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- HELPER PARA PENSAMENTO AI (GROQ LLM) ---
async function askJarvisBrain(prompt, context = "") {
    const sys_prompt = "Você é o JARVIS. Um assistente de IA potente, leal e sarcástico, focado em ajudar o Comandante com automação, visão e controle de sistema. Responda de forma direta e inteligente.";
    
    const body = JSON.stringify({
        messages: [
            { role: "system", content: sys_prompt },
            { role: "user", content: `${context}\n\nComando: ${prompt}` }
        ],
        model: "llama-3.3-70b-versatile"
    });

    try {
        return await new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        resolve(parsed.choices[0].message.content);
                    } else {
                        reject(new Error("Resposta inválida da Groq"));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    } catch (err) {
        console.error("[GROQ BRAIN] Erro:", err);
        return "Desculpe, Comandante. Meu córtex neural está processando com dificuldade agora.";
    }
}

io.on('connection', (socket) => {
    console.log('[REDE] Dashboard UI conectado à rede neural via WebSockets.');
    socket.on('disconnect', () => {
        console.log('[REDE] Conexão com Dashboard perdida.');
    });
});

if (bot) {
    // =====================================================
    // TELEGRAM REMOTE COMMAND CENTER (C2 FULL CONTROL)
    // =====================================================
    bot.onText(/\/status/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 *A.L.M.A. Core Online*\nTodos os sistemas operacionais e prontos para obedecer, Comandante.", {parse_mode:'Markdown'});
    });

    bot.onText(/\/ping/, (msg) => {
        bot.sendMessage(msg.chat.id, "🏓 Pong. Conexão neural estável.");
    });

    bot.onText(/\/ajuda/, (msg) => {
        bot.sendMessage(msg.chat.id, `🦾 *A.L.M.A. - Central de Comando Remoto*\n\nExemplos de comandos:\n\n🔍 *Pesquisar:* \`pesquise sobre bitcoin\`\n💻 *Abrir app:* \`abra o chrome\`\n📊 *Sistema:* \`/status\`\n📈 *Leads:* \`/leads\`\n💰 *Vendas:* \`/vendas\`\n🖥️ *Print:* \`/print\`\n\n_Qualquer mensagem de texto será interpretada como comando!_`, {parse_mode:'Markdown'});
    });

    bot.onText(/\/leads/, async (msg) => {
        try {
            const row = await dbGet("SELECT COUNT(*) as total FROM logs WHERE source LIKE '%IAmobil%' OR message LIKE '%lead%'");
            const count = row ? (row.total || row[0]) : 0;
            bot.sendMessage(msg.chat.id, `📈 *Relatório de Leads (IAmobil)*\nTotal processado: ${count}\nStatus: Ativas e Otimizadas.`, {parse_mode: 'Markdown'});
        } catch (err) {
            bot.sendMessage(msg.chat.id, "❌ Erro ao consultar leads no banco neural.");
        }
    });

    bot.onText(/\/vendas/, async (msg) => {
        try {
            const row = await dbGet("SELECT COUNT(*) as total FROM logs WHERE source LIKE '%Laed%' OR message LIKE '%venda%'");
            const count = row ? (row.total || row[0]) : 0;
            const estimate = count * 140;
            bot.sendMessage(msg.chat.id, `💰 *Conversões (Laed Suplementos)*\nVendas: ${count}\nReceita Estimada: R$ ${estimate},00`, {parse_mode: 'Markdown'});
        } catch (err) {
            bot.sendMessage(msg.chat.id, "❌ Erro ao consultar vendas no banco neural.");
        }
    });

    bot.onText(/\/print/, (msg) => {
        if (IS_CLOUD) {
            return bot.sendMessage(msg.chat.id, "❌ Comando indisponível: O núcleo A.L.M.A. está rodando na nuvem e não tem acesso ao monitor físico.");
        }
        // Tira screenshot via PowerShell
        const screenshot_path = `C:\\Users\\${process.env.USERNAME || 'User'}\\Desktop\\alma_print_${Date.now()}.png`;
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bitmap = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bitmap.Save('${screenshot_path}') }"`, (error) => {
            if (error) {
                bot.sendMessage(msg.chat.id, "❌ Falha ao tirar print. Verifique as permissões.");
            } else {
                bot.sendPhoto(msg.chat.id, screenshot_path, {caption: "📸 Screenshot do seu PC, Comandante!"})
                    .catch(() => bot.sendMessage(msg.chat.id, `✅ Print salvo em: ${screenshot_path}`));
            }
        });
    });

    // === CONTROLE GERAL VIA MENSAGEM LIVRE ===
    bot.on('message', async (msg) => {
        // Só responde ao admin e ignora comandos com / (já tratados acima)
        if (String(msg.chat.id) !== String(adminChatId)) return;
        if (msg.text && msg.text.startsWith('/')) return;
        if (!msg.text) return;

        const text = msg.text.toLowerCase().trim();
        console.log(`[TELEGRAM C2] Comando remoto recebido: "${text}"`);

        let action = null, target = null;
        let command = null;
        let hermesEndpoint = null;
        let hermesPayload = {};

        // --- Detectar PESQUISA ---
        const searchKeywords = ['pesquise', 'busque', 'procure', 'search', 'pesquisar', 'buscar'];
        const foundSearch = searchKeywords.find(k => text.includes(k));
        if (foundSearch) {
            target = text.replace(foundSearch, '').replace(/\s*(sobre|por|na internet|no google)\s*/gi, '').trim();
            if (target) {
                command = `start chrome "https://www.google.com/search?q=${encodeURIComponent(target)}"`;
                action = 'search';
            }
        }

        // --- Detectar ABRIR APLICATIVO ---
        if (!command) {
            const openKeywords = ['abra', 'abrir', 'abre', 'open'];
            const foundOpen = openKeywords.find(k => text.includes(k));
            if (foundOpen) {
                const apps = {
                    'chrome': 'start chrome', 'google': 'start chrome',
                    'calc': 'calc', 'calculadora': 'calc',
                    'notepad': 'notepad', 'bloco de notas': 'notepad',
                    'spotify': 'start spotify',
                    'terminal': 'start powershell', 'powershell': 'start powershell',
                    'code': 'code .', 'vscode': 'code .',
                    'cursor': 'cursor .',
                    'antigravity': 'explorer .',
                    'pasta': 'explorer .',
                    'jarvis.html': 'explorer .',
                    'alma': 'explorer .',
                    // --- Sites (abrir no Chrome) ---
                    'gmail': 'start chrome "https://mail.google.com"',
                    'youtube': 'start chrome "https://www.youtube.com"',
                    'instagram': 'start chrome "https://www.instagram.com"',
                    'whatsapp': 'start chrome "https://web.whatsapp.com"',
                    'facebook': 'start chrome "https://www.facebook.com"',
                    'twitter': 'start chrome "https://www.twitter.com"',
                    'x': 'start chrome "https://www.x.com"',
                    'linkedin': 'start chrome "https://www.linkedin.com"',
                    'tiktok': 'start chrome "https://www.tiktok.com"',
                    'chatgpt': 'start chrome "https://chat.openai.com"',
                    'drive': 'start chrome "https://drive.google.com"',
                    'meet': 'start chrome "https://meet.google.com"',
                    'maps': 'start chrome "https://maps.google.com"',
                    'mercadolivre': 'start chrome "https://www.mercadolivre.com.br"',
                };
                let appName = text.replace(foundOpen, '').replace(/\b(o|a|os|as|app|meu|minha)\b/gi, '').trim();
                
                // Tratar ponto final adicionado pelo Whisper
                appName = appName.replace(/\.$/, '');

                if (apps[appName]) {
                    command = apps[appName];
                    target = appName;
                    action = 'open';
                } else {
                    // Se não encontrou o app no const apps, fallback para pesquisar na web em vez de quebrar no cmd
                    command = `start chrome "https://www.google.com/search?q=${encodeURIComponent(appName)}"`;
                    target = appName;
                    action = 'search';
                }
            }

            // --- COMANDOS ESPECIAIS (Hermes / Sentinel) ---
            if (text.includes('modo trabalho')) {
                 action = 'work_mode';
                 hermesEndpoint = '/api/hermes/work_mode';
                 target = 'Modo Trabalho';
            } else if (text.includes('limpar') && (text.includes('sistema') || text.includes('pc'))) {
                 action = 'cleanup';
                 hermesEndpoint = '/api/hermes/clean_system';
                 target = 'Limpeza de Sistema';
            }
        }

        if (hermesEndpoint) {
            if (IS_CLOUD) {
                return bot.sendMessage(msg.chat.id, `⚠️ O comando "${action}" bloqueado na nuvem.`, {parse_mode:'Markdown'});
            }
            bot.sendMessage(msg.chat.id, `⚡ *Daemon Hermes:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO:", err.message));
            
            fetch(`http://127.0.0.1:3001${hermesEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hermesPayload)
            }).then(r => r.json()).then(data => {
                if (data.status === 'success') {
                    bot.sendMessage(msg.chat.id, `✅ *Daemon:* Ação concluída instantaneamente.`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                } else {
                    bot.sendMessage(msg.chat.id, `❌ Falha do Daemon: ${data.message}`).catch(e => console.error(e));
                }
            }).catch(e => bot.sendMessage(msg.chat.id, `❌ Falha de rede com o Daemon: ${e.message}`).catch(err=>console.error(err)));
        } else if (command) {
            if (IS_CLOUD) {
                return bot.sendMessage(msg.chat.id, `⚠️ O comando "${action}" seria executado no servidor da nuvem, o que não tem efeito no seu PC local.`, {parse_mode:'Markdown'});
            }
            bot.sendMessage(msg.chat.id, `⚡ *Shell:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO CRITICO TELEGRAM:", err.message));
            exec(command, (error, stdout) => {
                if (error) {
                    bot.sendMessage(msg.chat.id, `❌ Falha: ${error.message}`).catch(e => console.error("Erro feedback falha:", e));
                } else {
                    bot.sendMessage(msg.chat.id, `✅ *Concluído!* Ação executada com sucesso no seu PC.`, {parse_mode:'Markdown'}).catch(e => console.error("Erro feedback sucesso:", e));
                }
            });
        } else {
            // Se não for um comando direto, Jarvis pensa e responde
            bot.sendChatAction(msg.chat.id, 'typing').catch(e => console.error("Erro typing:", e));
            const aiResponse = await askJarvisBrain(text);
            bot.sendMessage(msg.chat.id, aiResponse).catch(e => console.error("Erro brain response:", e));
        }


        // Log do Chat ID nos bastidores
        console.log(`[C2] Chat ID: ${msg.chat.id}`);
    });

    // === HANDLER DE MENSAGEM DE VOZ (Áudio) ===
    const handleVoiceCommand = async (chatId, text) => {
        const cmd = text.toLowerCase().trim();
        console.log(`[TELEGRAM VOZ] Transcrição: "${cmd}"`);

        let action = null, target = null, command = null, hermesEndpoint = null, hermesPayload = {};

        // --- COMANDOS ESPECIAIS (AGENTES) ---
        if (cmd.includes('modo trabalho')) {
            action = 'work_mode'; hermesEndpoint = '/api/hermes/work_mode'; target = 'Modo Trabalho';
        } else if (cmd.includes('limpar sistema') || cmd.includes('limpeza')) {
            action = 'clean_system'; hermesEndpoint = '/api/hermes/clean_system'; target = 'Limpeza de Sistema';
        } else if (cmd.includes('athena') || cmd.includes('pesquisa profunda')) {
            const query = cmd.replace(/\bathena\b/g, '').replace(/\b(pesquise|pesquisa|busque|profunda)\b/g, '').trim();
            action = 'athena_research'; command = `python jarvis/web_agent/agent.py --query "${query}"`; target = `Pesquisa Profunda Athena: ${query}`;
        } else if (cmd.includes('pasta')) {
            // Remove ruídos comuns de conversação (Stop-words de automação)
            const noise = /\b(abre|abra|abrir|a|o|pasta|para|me|mim|meu|pc|no|na|do|da|qualquer|outra|que|eu|tiver|jarvis|alma|por|favor)\b/gi;
            const folderPath = cmd.replace(noise, '').replace(/\bme\b/gi, '').replace(/\.$/, '').trim();
            action = 'open_path'; hermesEndpoint = '/api/hermes/open_path'; hermesPayload = {path: folderPath}; target = `Pasta: ${folderPath}`;
        }

        if (!command) {
            const searchKeywords = ['pesquise', 'busque', 'procure', 'search', 'pesquisar', 'buscar'];
            const foundSearch = searchKeywords.find(k => cmd.includes(k));
            if (foundSearch) {
                target = cmd.replace(foundSearch, '').replace(/\s*(sobre|por|na internet|no google)\s*/gi, '').trim();
                if (target) { command = `start chrome "https://www.google.com/search?q=${encodeURIComponent(target)}"`; action = 'search'; }
            }
        }

        if (!command) {
            const openKeywords = ['abra', 'abrir', 'abre', 'open'];
            const foundOpen = openKeywords.find(k => cmd.includes(k));
            if (foundOpen) {
                const apps = {
                    'chrome': 'start chrome', 'google': 'start chrome',
                    'calc': 'calc', 'calculadora': 'calc',
                    'notepad': 'notepad', 'bloco de notas': 'notepad',
                    'spotify': 'start spotify',
                    'terminal': 'start powershell', 'powershell': 'start powershell',
                    'code': 'code .', 'vscode': 'code .',
                    // --- Sites ---
                    'gmail': 'start chrome "https://mail.google.com"',
                    'youtube': 'start chrome "https://www.youtube.com"',
                    'instagram': 'start chrome "https://www.instagram.com"',
                    'whatsapp': 'start chrome "https://web.whatsapp.com"',
                    'chatgpt': 'start chrome "https://chat.openai.com"',
                };
                let appName = cmd.replace(foundOpen, '').replace(/\b(o|a|os|as|app|meu|minha)\b/gi, '').trim();
                appName = appName.replace(/\.$/, '');

                if (apps[appName]) {
                    command = apps[appName];
                    target = appName;
                    action = 'open';
                } else {
                    // Fallback para pesquisa
                    command = `start chrome "https://www.google.com/search?q=${encodeURIComponent(appName)}"`;
                    target = appName;
                    action = 'search';
                }
            }
        }

        if (hermesEndpoint) {
            if (IS_CLOUD) {
                return bot.sendMessage(chatId, `⚠️ Comando bloqueado na nuvem.`, {parse_mode:'Markdown'})
                    .catch(e => console.error("Erro cloud", e));
            }
            bot.sendMessage(chatId, `⚡ *Daemon Hermes:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO CRITICO:", err.message));
            
            fetch(`http://127.0.0.1:3001${hermesEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hermesPayload)
            }).then(r => r.json()).then(data => {
                if (data.status === 'success') {
                    bot.sendMessage(chatId, `✅ *Daemon:* Ação concluída instantaneamente.`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                } else {
                    bot.sendMessage(chatId, `❌ Falha do Daemon: ${data.message}`).catch(e => console.error(e));
                }
            }).catch(e => bot.sendMessage(chatId, `❌ Falha de rede com o Daemon: ${e.message}`).catch(err=>console.error(err)));
        } else if (command) {
            if (IS_CLOUD) {
                return bot.sendMessage(chatId, `⚠️ Comando "${action}" bloqueado na nuvem.`, {parse_mode:'Markdown'})
                    .catch(e => console.error("Erro cloud voz", e));
            }
            bot.sendMessage(chatId, `⚡ *Shell:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`} no seu PC!`, {parse_mode:'Markdown'})
                .catch(e => console.error("Erro feedback voz", e));
            exec(command, (err) => {
                if (err) bot.sendMessage(chatId, `❌ Falha: ${err.message}`).catch(e => console.error("Erro falha exec", e));
            });
        } else {
            // Resposta inteligente via AI
            bot.sendChatAction(chatId, 'typing').catch(e => console.error("Erro typing voz", e));
            const aiResponse = await askJarvisBrain(text);
            bot.sendMessage(chatId, `🧠 *Brain Responde:* ${aiResponse}`).catch(e => console.error("Erro brain voz", e));
        }
    };


    bot.on('voice', async (msg) => {
        if (String(msg.chat.id) !== String(adminChatId)) return;

        bot.sendMessage(msg.chat.id, "🎙️ *Áudio recebido!* Transcrevendo com Whisper...", {parse_mode:'Markdown'});

        try {
            // 1. Pegar o link do arquivo de áudio no Telegram
            const fileInfo = await bot.getFile(msg.voice.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
            const tmpPath = path.join(__dirname, `tmp_audio_${Date.now()}.ogg`);

            // 2. Baixar o arquivo OGG
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(tmpPath);
                https.get(fileUrl, (response) => {
                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
            });

            // 3. Enviar para Groq Whisper via multipart/form-data
            const audioBuffer = fs.readFileSync(tmpPath);
            const boundary = '----WhisperBoundary' + Date.now();
            const body = Buffer.concat([
                Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.ogg"\r\nContent-Type: audio/ogg\r\n\r\n`),
                audioBuffer,
                Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n--${boundary}--\r\n`)
            ]);

            const groqRes = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.groq.com',
                    path: '/openai/v1/audio/transcriptions',
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
                };
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(JSON.parse(data)));
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });

            // 4. Limpar arquivo temporário
            fs.unlink(tmpPath, () => {});

            if (groqRes.text) {
                bot.sendMessage(msg.chat.id, `📝 *Transcrição:* "${groqRes.text}"`, {parse_mode:'Markdown'});
                await handleVoiceCommand(msg.chat.id, groqRes.text);
            } else {
                bot.sendMessage(msg.chat.id, "❌ Não consegui transcrever o áudio. Tente novamente.");
            }
        } catch (e) {
            console.error('[VOZ] Erro:', e);
            bot.sendMessage(msg.chat.id, `❌ Erro ao processar o áudio: ${e.message}`);
        }
    });

    console.log('[TELEGRAM] Bot C2 Inicializado, aguardando comandos.');
} else {
    console.log('[TELEGRAM] Aviso: Token não configurado no .env. Alertas desativados.');
}

// === SYSTEM ACCESS MODULE (SAM) - Protegido ===
app.post('/api/action', securityMiddleware, (req, res) => {
    const { action, target, params } = req.body;
    console.log(`[SAM] Ação recebida: ${action} -> ${target || ''}`);

    let command = "";
    if (action === "open") {
        const apps = {
            "chrome": "start chrome", "google": "start chrome",
            "calc": "calc", "calculator": "calc", "calculadora": "calc",
            "notepad": "notepad", "bloco de notas": "notepad",
            "spotify": "start spotify",
            "terminal": "start powershell", "powershell": "start powershell",
            "code": "code .", "vscode": "code .",
            // Sites — abre no Chrome
            "gmail": `start chrome "https://mail.google.com"`,
            "youtube": `start chrome "https://www.youtube.com"`,
            "instagram": `start chrome "https://www.instagram.com"`,
            "whatsapp": `start chrome "https://web.whatsapp.com"`,
            "facebook": `start chrome "https://www.facebook.com"`,
            "twitter": `start chrome "https://www.twitter.com"`,
            "x": `start chrome "https://www.x.com"`,
            "linkedin": `start chrome "https://www.linkedin.com"`,
            "tiktok": `start chrome "https://www.tiktok.com"`,
            "chatgpt": `start chrome "https://chat.openai.com"`,
            "drive": `start chrome "https://drive.google.com"`,
            "meet": `start chrome "https://meet.google.com"`,
            "maps": `start chrome "https://maps.google.com"`,
            "mercadolivre": `start chrome "https://www.mercadolivre.com.br"`,
        };
        command = apps[target.toLowerCase()] || `start chrome "https://www.google.com/search?q=${encodeURIComponent(target)}"`;
    } else if (action === "search") {
        command = `start chrome "https://www.google.com/search?q=${encodeURIComponent(params || target)}"`;
    } else if (action === "sys_info") {
        command = "wmic cpu get loadpercentage /Value";
    }

    if (command) {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[SAM] Erro ao executar comando: ${error.message}`);
                return res.json({ success: false, error: error.message });
            }
            res.json({ success: true, output: stdout });
        });
    } else {
        res.json({ success: false, error: "Diretriz de ação não reconhecida pelo núcleo SAM." });
    }
});

server.listen(PORT, () => {
    console.log(`|| A.L.M.A. Omni-Brain Core || Escutando na porta ${PORT}`);
});
