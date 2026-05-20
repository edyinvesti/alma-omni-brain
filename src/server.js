require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { Bot, InputFile } = require('grammy');
const { exec, execSync } = require('child_process');
const { createClient } = require('@libsql/client');
const FormData = require('form-data');

const ALLOWED_DIRS = [os.homedir(), process.env.USERPROFILE || 'C:\\Users\\User'];
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;

const BRAIN_CACHE_TTL = 1000 * 60 * 30;
const brainCache = new Map();
function getCacheKey(prompt) {
    return prompt.toLowerCase().trim().substring(0, 100);
}

setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [key, val] of brainCache) {
        if (now - val.timestamp > BRAIN_CACHE_TTL) {
            brainCache.delete(key);
            removed++;
        }
    }
    if (removed > 0) console.log(`[BRAIN CACHE] Limpeza: ${removed} entradas removidas`);
}, 1000 * 60 * 10);

function cleanRateLimit() {
    const now = Date.now();
    for (const [key, val] of rateLimit) {
        if (now > val.resetTime + 60000) rateLimit.delete(key);
    }
}
setInterval(cleanRateLimit, 300000);

const ENDPOINT_LIMITS = {
    '/api/brain': { max: 10, window: 60000 },
    '/api/action': { max: 20, window: 60000 },
    '/health': { max: 100, window: 60000 },
    'default': { max: 30, window: 60000 }
};

function checkRateLimit(identifier, endpoint = 'default') {
    const now = Date.now();
    const limitConfig = ENDPOINT_LIMITS[endpoint] || ENDPOINT_LIMITS['default'];
    const { max, window } = limitConfig;
    const key = `${identifier}:${endpoint}`;
    
    if (!rateLimit.has(key)) {
        rateLimit.set(key, { count: 1, resetTime: now + window });
        return true;
    }
    const limit = rateLimit.get(key);
    if (now > limit.resetTime) {
        rateLimit.set(key, { count: 1, resetTime: now + window });
        return true;
    }
    if (limit.count >= max) return false;
    limit.count++;
    return true;
}

function sanitizeCommand(command) {
    if (!command || typeof command !== 'string') return '';
    // [SECURITY PATCH] Impede injeção via PowerShell subexpressions $(), escape de backtick, 
    // ou encadeamento de comandos. Permite '&' APENAS para queries de URL seguras.
    return command.replace(/"/g, '\\"')
                  .replace(/;/g, '')
                  .replace(/\|/g, '')
                  .replace(/`/g, '')
                  .replace(/\$|\(|\)|<|>/g, '')
                  .replace(/\n/g, '');
}

function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const normalized = path.normalize(filePath);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
        return ALLOWED_DIRS.some(dir => normalized.startsWith(dir));
    }
    return true;
}

const API_SECRET = process.env.API_SECRET;
if (!API_SECRET) {
    console.error("[ERRO FATAL] API_SECRET não configurado no .env!");
    process.exit(1);
}

const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];
const JWT_SECRET = process.env.JWT_SECRET || API_SECRET + '_jwt_2026';

function verifyIP(ip) {
    if (ALLOWED_IPS.length === 0) return true;
    const cleanIP = ip.replace(/^::ffff:/, '').replace(/^127\.0\.0\.1$/, 'localhost');
    return ALLOWED_IPS.includes(cleanIP) || ALLOWED_IPS.includes(ip);
}

function verifyJWT(token) {
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const [header, payload, signature] = parts;
        const expectedSig = require('crypto').createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('hex').substring(0, 8);
        return signature === expectedSig;
    } catch { return false; }
}

function generateJWT(userId) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + 86400000 })).toString('base64url');
    const signature = require('crypto').createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('hex').substring(0, 8);
    return `${header}.${payload}.${signature}`;
}

function checkRateLimit(identifier) {
    const now = Date.now();
    if (!rateLimit.has(identifier)) {
        rateLimit.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }
    const limit = rateLimit.get(identifier);
    if (now > limit.resetTime) {
        rateLimit.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }
    if (limit.count >= RATE_LIMIT_MAX) return false;
    limit.count++;
    return true;
}

// ✅ NOVOS MÓDULOS INTEGRADOS
const Database = require('./database');
const ActionQueue = require('./action_queue');
const ActionParser = require('./action_parser');
const AppFinder = require('./app_finder');

// Chave Groq para Whisper e Chat
const GROQ_API_KEY = (process.env.GROQ_API_KEY || process.env.GROQ_KEY || "").trim();
if (!GROQ_API_KEY) {
    console.warn("[AVISO] GROQ_API_KEY não configurada no .env");
}

// Chave Gemini para fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Detecta modo Nuvem
const IS_CLOUD = process.env.CLOUD_MODE === 'true' || !!process.env.RENDER;

const botToken = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : undefined;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID ? process.env.TELEGRAM_ADMIN_CHAT_ID.trim() : undefined;
let bot = null;

if (!botToken || !adminChatId) {
    console.warn("[TELEGRAM] AVISO: Token ou Chat ID não configurados no .env. Bot desativado.");
} else if (botToken.length < 30 || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
    console.error("[TELEGRAM] ERRO: Token do Telegram inválido!");
} else if (!/^\d+$/.test(adminChatId)) {
    console.error("[TELEGRAM] ERRO: Chat ID do admin inválido!");
} else {
    try {
        bot = new Bot(botToken);
        console.log('[TELEGRAM] Bot C2 (Grammy) inicializado.');
    } catch(e) {
        console.log("[TELEGRAM] Erro ao iniciar bot:", e.message);
        bot = null;
    }

    // Comando /status
    bot.command("status", async (ctx) => {
        await ctx.reply("🤖 A.L.M.A. Core Online.\nTodos os sistemas estão operacionais.");
    });

    // Comando /ping
    bot.command("ping", async (ctx) => {
        await ctx.reply("🏓 Pong. Conexão neural estável.");
    });

    // Comando /ajuda
    bot.command("ajuda", async (ctx) => {
        await ctx.reply(`🦾 *A.L.M.A. - Central de Comando Remoto*\n\nExemplos de comandos:\n\n🔍 *Pesquisar:* \`pesquise sobre bitcoin\`\n💻 *Abrir app:* \`abra o chrome\`\n📊 *Sistema:* \`/status\``, { parse_mode: "Markdown" });
    });



    console.log('[TELEGRAM] Bot C2 Inicializado, aguardando comandos.');


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

const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'];
const io = new Server(server, {
    cors: {
        origin: CORS_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true
}));
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", 
        "default-src 'self'; " +
        "script-src 'self' https://cdn.jsdelivr.net https://cdn.socket.io https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https://cdn-icons-png.flaticon.com; " +
        "connect-src 'self' https://cdn.socket.io https://cdn.jsdelivr.net; " +
        "frame-src 'none'; " +
        "object-src 'none'; " +
        "base-uri 'self';");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "microphone=(), camera=(), geolocation=()");
    next();
});


const securityMiddleware = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const endpoint = req.path;

    if (!verifyIP(ip)) {
        console.warn(`[SENTINEL] IP bloqueado! IP: ${ip} Endpoint: ${endpoint}`);
        return res.status(403).json({ error: 'IP não autorizado.' });
    }

    if (!checkRateLimit(ip, endpoint)) {
        console.warn(`[SENTINEL] Rate limit excedido! IP: ${ip} Endpoint: ${endpoint}`);
        return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
    }

    const incomingSecret = req.headers['x-alma-key'];
    if (incomingSecret !== API_SECRET) {
        console.warn(`[SENTINEL] Tentativa de acesso não autorizado! IP: ${ip} para ${req.path}`);

        dbExecute('INSERT INTO logs (source, message) VALUES (?, ?)', ['SENTINEL', `ALERTA: Tentativa de acesso não autorizado no endpoint ${req.path} vindo do IP ${ip}`])
            .catch(err => console.error("Falha ao salvar log de segurança", err));

        if (bot && adminChatId) {
            bot.api.sendMessage(adminChatId, `🚨 [ALERTA SENTINEL]\nTentativa de invasão detectada!\nIP: ${ip}\nEndpoint: ${req.path}`);
        }
        return res.status(403).json({ error: 'Acesso negado pelo protocolo Sentinel.' });
    }
    next();
};

app.use(express.static(path.join(__dirname, '../public'))); // Serve os arquivos estáticos da pasta public

// --- CONFIGURAÇÃO DO BANCO DE DADOS (TURSO CLOUD) ---
let db_type = "cloud";
let db = null;

// ✅ INTEGRAÇÃO NOVO DATABASE (com retry automático)
const TURSO_URL = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : undefined;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : undefined;

if (TURSO_URL && TURSO_TOKEN) {
    // Usa o novo módulo Database com retry
    Database.connect().then(() => {
        console.log('[SISTEMA] Banco Turso conectado (novo módulo).');
    }).catch(e => {
        console.error('[SISTEMA] Erro ao conectar banco:', e.message);
    });
} else {
    console.error('[ERRO FATAL] Variáveis TURSO não configuradas!');
    process.exit(1);
}

// Mantém compatibilidade com código existente
async function dbExecute(sql, params = []) {
    try {
        const result = await Database.client?.execute?.({ sql, args: params });
        return result || { lastInsertRowid: 0 };
    } catch (e) {
        console.log('[DB] Erro, tentando reconectar...');
        await Database.reconnect();
        throw e;
    }
}

// Inicializa as tabelas do Omni-Brain em ambos os modos (Local e Nuvem)
const initDB = async () => {
    try {
        await Database.connect();
        await Database.client.execute({ sql: 'CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)' });
        await Database.client.execute({ sql: 'CREATE TABLE IF NOT EXISTS memory (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, value TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)' });
        await Database.client.execute({ sql: 'CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)' });
        console.log('[SISTEMA] Tabelas do Omni-Brain inicializadas.');
    } catch (err) {
        console.error('[ERRO DB] Falha na inicialização:', err.message);
    }
};
initDB();


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
    try {
        res.json({ status: 'ok', uptime: process.uptime(), system: 'A.L.M.A. Core' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// FIX 8: Endpoint de dados reais do sistema (CPU, Memória, Uptime)
app.get('/api/sysinfo', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const cpuCount = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model?.split(' ')[0] || 'CPU';
    const uptimeSecs = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptimeSecs/3600)}h ${Math.floor((uptimeSecs%3600)/60)}m`;
    res.json({
        mem_used_gb: (usedMem / 1e9).toFixed(1),
        mem_total_gb: (totalMem / 1e9).toFixed(1),
        mem_percent: memPercent,
        cpu_cores: cpuCount,
        cpu_model: cpuModel,
        uptime: uptimeStr,
        platform: os.platform()
    });
});

// ✅ NOVOS ENDPOINTS
// Status da Fila de Ações
app.get('/api/queue-status', (req, res) => {
    res.json(ActionQueue.getStatus());
});

// Buscar apps instalados (para Alma "ver" o que tem)
app.get('/api/apps', async (req, res) => {
    const query = req.query.q || '';
    if (!query) return res.json({ apps: [] });
    
    const app = await AppFinder.findBestApp(query);
    res.json({ found: !!app, app });
});

// Adicionar ação à fila manualmente
app.post('/api/queue-add', securityMiddleware, async (req, res) => {
    const { type, target, priority = 5 } = req.body;
    if (!type) return res.status(400).json({ error: 'Falta tipo' });
    
    const result = await ActionQueue.add({ type, target }, priority);
    res.json({ success: true, result });
});

// FIX 7: Ponte Python → Node (recebe telemetria do main.py)
app.post('/api/python-bridge', async (req, res) => {
    const { event, data } = req.body;
    if (!event) return res.status(400).json({ error: 'Faltando campo event' });
    console.log(`[PYTHON BRIDGE] Evento recebido: ${event}`, data || '');
    try {
        await dbExecute('INSERT INTO logs (source, message) VALUES (?, ?)', ['PYTHON', `${event}: ${JSON.stringify(data || {})}`]);
        io.emit('new_log', { source: 'PYTHON', message: `${event}: ${JSON.stringify(data || {})}`, timestamp: new Date().toISOString() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX 9: Endpoint de limpeza de memória duplicada
app.post('/api/memory/cleanup', securityMiddleware, async (req, res) => {
    try {
        // Remove entradas antigas mantendo apenas a mais recente por chave
        await dbExecute(`DELETE FROM memory WHERE id NOT IN (
            SELECT MAX(id) FROM memory GROUP BY key
        )`);
        const remaining = await dbExecute('SELECT COUNT(*) as total FROM memory');
        const total = remaining.rows[0]?.total || 0;
        console.log(`[MEMÓRIA] Cleanup concluído. Entradas únicas: ${total}`);
        res.json({ success: true, unique_keys: total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX 5: Endpoint para recarregar logs recentes ao reconectar
app.get('/api/logs-recent', securityMiddleware, async (req, res) => {
    try {
        const result = await dbExecute('SELECT source, message, timestamp FROM logs ORDER BY id DESC LIMIT 20');
        res.json({ logs: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/telegram/send-photo', securityMiddleware, async (req, res) => {
    const { path: filePath, caption } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Faltando "path" do arquivo' });
    if (!bot || !adminChatId) return res.status(500).json({ error: 'Telegram Bot não configurado' });

    if (!validateFilePath(filePath)) {
        return res.status(400).json({ error: 'Caminho de arquivo não permitido.' });
    }

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo não encontrado no PC' });
        }
        const { InputFile } = require('grammy');
        await bot.api.sendPhoto(adminChatId, new InputFile(filePath), { caption: caption || "📸 Captura de tela enviada pelo Alma." });
        res.json({ success: true, message: 'Foto enviada com sucesso!' });
    } catch (err) {
        console.error("[TELEGRAM] Erro ao enviar foto:", err.message);
        res.status(500).json({ error: err.message });
    }
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
            bot.api.sendMessage(adminChatId, `📡 [ALERTA OMNI-BRAIN]\nOrigem: ${source}\nMensagem: ${message}`);
        }
        
        console.log(`[LOG] Novo evento registrado: ${source} - ${message}`);
        res.json({ success: true, id: lastID });
    } catch (err) {
        console.error("[ERRO DB] Falha na telemetria:", err);
        res.status(500).json({ error: err.message });
    }
});

const { searchKnowledge } = require('./vector_search');

// --- HELPER PARA RECUPERAR CONTEXTO OMNI ---
async function getOmniContext(query = "") {
    try {
        const facts = await dbExecute('SELECT key, value FROM memory ORDER BY timestamp DESC');
        const history = await dbExecute('SELECT role, content FROM history ORDER BY id DESC LIMIT 20');
        
        let context = "=== MEMÓRIA E FATOS ===\n";
        facts.rows.forEach(f => context += `${f.key}: ${f.value}\n`);
        
        // --- BUSCA RAG VETORIAL (CONHECIMENTO TÉCNICO) ---
        if (query) {
            const knowledge = await searchKnowledge(query, 2);
            if (knowledge.length > 0) {
                context += "\n=== CONHECIMENTO TÉCNICO VETORIAL (RAG) ===\n";
                knowledge.forEach(k => context += `[${k.title}]: ${k.content.substring(0, 500)}...\n`);
            }
        }
        
        context += "\n=== HISTÓRICO RECENTE ===\n";
        history.rows.reverse().forEach(h => context += `${h.role}: ${h.content}\n`);
        
        return context;
    } catch (err) {
        console.error("[CONTEXTO] Erro ao carregar:", err);
        return "";
    }
}

// --- HELPER PARA PROCESSAR AÇÕES (NOVO MÓDULO) ---
async function handleMemoryActions(response) {
    // ✅ Usa o novo ActionParser com múltiplos patterns
    const { actions, cleanedText } = ActionParser.parse(response);
    
    if (actions.length > 0) {
        console.log(`[AÇÕES] Detectadas ${actions.length} ações`);
        
        for (const action of actions) {
            // ✅ Usa a nova fila de ações (não executa imediatamente)
            if (action.type === 'update_memory' && action.key) {
                await Database.memorySet(action.key, action.value || '');
                console.log(`[MEMÓRIA] Atualizado: ${action.key}`);
            } else if (action.type === 'update_biography') {
                await Database.log('info', `Biografia: ${action.fact}`, 'ALMA_LEARNING');
            } else if (action.type === 'save_knowledge' && action.title && action.content) {
                try {
                    const vectorRag = require('../bin/vector_rag.js');
                    await vectorRag.addKnowledgeWithEmbedding('ALMA_Core', action.title, action.content);
                    console.log(`[RAG] Novo conhecimento vetorizado: ${action.title}`);
                } catch (e) {
                    console.error("[RAG] Erro ao vetorizar:", e.message);
                }
            } else {
                // Ações de automação vão para a fila
                const queueAction = {
                    type: action.type === 'open' ? 'open_url' : action.type,
                    target: action.target || action.url || ''
                };
                
                await ActionQueue.add(queueAction, 5);
                console.log(`[FILA] Ação adicionada: ${action.type} -> ${action.target}`);
            }
        }
    }
    
    return cleanedText || response;
}

// Endpoint para ações manuais ou via script.js
app.post('/api/action', securityMiddleware, async (req, res) => {
    try {
        const actionData = req.body;
        // Transformamos o objeto em string para usar o handler existente
        await handleMemoryActions(`[[ACTION: ${JSON.stringify(actionData)}]]`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SISTEMA DE FALLBACK DE MODELOS GROQ ---
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
];
// Guarda qual modelo está ativo no momento
let currentModelIndex = 0;

function getActiveModel() {
    return GROQ_MODELS[currentModelIndex];
}

// Faz uma chamada para um modelo específico
async function callGroqModel(model, messages) {
    const body = JSON.stringify({ messages, model });
    return new Promise((resolve, reject) => {
        let req;
        const timeoutId = setTimeout(() => {
            if (req) req.destroy();
            reject({ message: 'Request Timeout (30s)', isRateLimit: false });
        }, 30000);

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
        req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeoutId);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        resolve(parsed.choices[0].message.content);
                    } else {
                        const errMsg = parsed.error?.message || JSON.stringify(parsed).substring(0, 200);
                        const isRateLimit = errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');
                        reject({ message: errMsg, isRateLimit });
                    }
                } catch(e) {
                    reject({ message: data.substring(0, 200), isRateLimit: false });
                }
            });
        });
        req.on('error', (e) => reject({ message: e.message, isRateLimit: false }));
        req.write(body);
        req.end();
    });
}

// --- GEMINI FALLBACK ---
async function callGemini(prompt, context = "") {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY não configurada");
    }
    
    const fullPrompt = `${prompt}\n\nContexto: ${context}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
        })
    });
    
    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    throw new Error("Resposta Gemini inválida");
}

// --- HELPER PARA PENSAMENTO AI (GROQ LLM) com Fallback Automático ---
let dailyAiRequests = 0;
let lastRequestDate = new Date().toDateString();
const AI_ALERT_THRESHOLD = 400; // Alerta de uso de créditos (supondo 500 limite/dia)
let hasSentAiAlert = false;

async function askAlmaBrain(prompt, context = "") {
    const cacheKey = getCacheKey(prompt);
    const cached = brainCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < BRAIN_CACHE_TTL)) {
        console.log(`[BRAIN CACHE] Hit para: "${prompt.substring(0, 30)}..."`);
        return cached.response;
    }

    // Alerta de Billing (Fix 4)
    const today = new Date().toDateString();
    if (today !== lastRequestDate) {
        dailyAiRequests = 0;
        lastRequestDate = today;
        hasSentAiAlert = false;
    }
    dailyAiRequests++;
    if (dailyAiRequests >= AI_ALERT_THRESHOLD && !hasSentAiAlert) {
        hasSentAiAlert = true;
        if (bot && adminChatId) {
            bot.api.sendMessage(adminChatId, `⚠️ *Aviso de Billing:* Você atingiu o limite seguro de consultas de IA diárias (${dailyAiRequests} usos). Cuidado com o crédito nas APIs gratuitas!`, { parse_mode: "Markdown" }).catch(e=>console.error("Erro billing:", e));
        }
    }

    // Injeta data/hora de Brasília em tempo real
    const agora = new Date();
    const optsData = { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const optsHora = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const dataAtual = agora.toLocaleDateString('pt-BR', optsData);
    const horaAtual = agora.toLocaleTimeString('pt-BR', optsHora);

    const sys_prompt = `Você é o ALMA (ALMA CORE). Um assistente de IA potente, leal e EXTREMAMENTE DIRETO.
    
    🕐 DATA E HORA ATUAL (Brasília, UTC-3): ${dataAtual}, ${horaAtual} BRT
    
    🏙️ NÚCLEO DE GESTÃO (20 EMPRESAS):
    1. Sua missão agora inclui a gestão e aprendizado de 20 empresas.
    2. Sempre que o Comandante mencionar uma empresa, verifique a memória para associar fatos, metas e leads a ela.
    3. Se aprender algo novo sobre uma empresa, salve usando chaves como: "empresa_[nome]_[fato]".
    
    REGRAS DE OURO (MUITO IMPORTANTE):
    1. Seja CURTO e DIRETO. Máximo de 2 frases.
    2. NUNCA descreva o que vai fazer ou mencione "Vou atualizar minha memória", "Vou registrar isso", etc.
    3. As tags [[ACTION]] são invisíveis; NUNCA mencione-as na resposta.
    4. NÃO REPITA respostas que já foram dadas no histórico recente.
    5. Não use saudações longas ou despedidas.
    6. Use a data/hora fornecida acima APENAS se o Comandante perguntar explicitamente.
    
    DIRETRIZES TÉCNICAS (SAM):
    - Falar com o usuário (Voz): [[ACTION: {"type":"speak", "text":"..."}]]
    - Fatos Curtos: [[ACTION: {"type":"update_memory", "key":"...", "value":"..."}]]
    - Dados Longos/Documentos: [[ACTION: {"type":"save_knowledge", "title":"...", "content":"..."}]]
    - ABRIR/PESQUISAR: [[ACTION: {"type":"open_url", "target":"..."}]]
    
    INSTRUÇÃO ESPECIAL:
    Se o Comandante perguntar "Qual é o seu nome?" ou similar, responda em texto E inclua a ação de fala: [[ACTION: {"type":"speak", "text":"Meu nome é ALMA. Sou sua inteligência central."}]]
    
    Contexto Omni: ${context}`;

    const messages = [
        { role: "system", content: sys_prompt },
        { role: "user", content: `Instrução: ${prompt}` }
    ];

    await dbExecute('INSERT INTO history (role, content) VALUES (?, ?)', ['Comandante', prompt]);

    // Tenta cada modelo em sequência (fallback automático)
    for (let i = currentModelIndex; i < GROQ_MODELS.length; i++) {
        const model = GROQ_MODELS[i];
        try {
            console.log(`[GROQ] Usando modelo: ${model}`);
            const response = await callGroqModel(model, messages);
            
            if (i !== currentModelIndex) {
                currentModelIndex = i;
                console.log(`[GROQ] ✅ Modelo ativo atualizado para: ${model}`);
                io.emit('new_log', { source: 'SISTEMA', message: `🔄 IA mudou para modelo: ${model}`, timestamp: new Date().toISOString() });
            }

            await dbExecute('INSERT INTO history (role, content) VALUES (?, ?)', ['ALMA', response]);
            await handleMemoryActions(response);
            brainCache.set(cacheKey, { response, timestamp: Date.now() });
            return response;

        } catch (err) {
            if (err.isRateLimit) {
                console.warn(`[GROQ] ⚠️ Rate limit em "${model}". Tentando próximo modelo...`);
                io.emit('new_log', { source: 'SISTEMA', message: `⚠️ Crédito esgotado em "${model}", trocando...`, timestamp: new Date().toISOString() });
            } else {
                console.error(`[GROQ] Erro em "${model}":`, err.message);
            }
        }
    }

    // Todos os modelos falharam — tenta Gemini como fallback
    console.warn('[GROQ] 🚨 Todos os modelos Groq esgotados. Tentando Gemini...');
    
    if (GEMINI_API_KEY) {
        try {
            const geminiResponse = await callGemini(prompt, context);
            await dbExecute('INSERT INTO history (role, content) VALUES (?, ?)', ['ALMA', geminiResponse]);
            await handleMemoryActions(geminiResponse);
            brainCache.set(cacheKey, { response: geminiResponse, timestamp: Date.now() });
            io.emit('new_log', { source: 'SISTEMA', message: '🔄 IA usando Gemini como fallback', timestamp: new Date().toISOString() });
            return geminiResponse;
        } catch (geminiErr) {
            console.error('[GEMINI] Erro:', geminiErr.message);
        }
    }

    // Tenta OpenRouter
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (OPENROUTER_KEY) {
        try {
            console.warn('[OPENROUTER] Tentando fallback via OpenRouter (auto)...');
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`,
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Jarvis ALMA',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openrouter/auto',
                    messages: [{ role: 'user', content: `${prompt}\n\nContexto: ${context}` }]
                })
            });
            const orData = await orRes.json();
            if (orData.choices && orData.choices[0]) {
                const orResponse = orData.choices[0].message.content;
                await dbExecute('INSERT INTO history (role, content) VALUES (?, ?)', ['ALMA', orResponse]);
                await handleMemoryActions(orResponse);
                brainCache.set(cacheKey, { response: orResponse, timestamp: Date.now() });
                io.emit('new_log', { source: 'SISTEMA', message: '🔄 IA usando OpenRouter como fallback', timestamp: new Date().toISOString() });
                return orResponse;
            }
            throw new Error(JSON.stringify(orData));
        } catch (orErr) {
            console.error('[OPENROUTER] Erro:', orErr.message || orErr);
        }
    }

    // Tenta HuggingFace como último recurso
    const HF_KEY = process.env.HF_API_KEY;
    if (HF_KEY) {
        try {
            console.warn('[HUGGINGFACE] Tentando fallback via HuggingFace (Mistral)...');
            const hfRes = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: `[INST] Você é o ALMA, um assistente de IA direto e leal.\n\n${context}\n\nInstrução: ${prompt} [/INST]`,
                    parameters: { max_new_tokens: 400, return_full_text: false }
                })
            });
            const hfData = await hfRes.json();
            if (Array.isArray(hfData) && hfData[0]?.generated_text) {
                const hfResponse = hfData[0].generated_text.trim();
                await dbExecute('INSERT INTO history (role, content) VALUES (?, ?)', ['ALMA', hfResponse]);
                await handleMemoryActions(hfResponse);
                brainCache.set(cacheKey, { response: hfResponse, timestamp: Date.now() });
                io.emit('new_log', { source: 'SISTEMA', message: '🔄 IA usando HuggingFace como fallback', timestamp: new Date().toISOString() });
                return hfResponse;
            }
            throw new Error(JSON.stringify(hfData));
        } catch (hfErr) {
            console.error('[HUGGINGFACE] Erro:', hfErr.message || hfErr);
        }
    }
    
    // Todos falharam
    const alertMsg = '🚨 ALERTA: Créditos de IA esgotados em todos os modelos. O sistema de IA está temporariamente offline.';
    io.emit('new_log', { source: '⚠️ SISTEMA', message: alertMsg, timestamp: new Date().toISOString() });
    io.emit('ai_offline', { message: alertMsg });

    if (bot && adminChatId) {
        bot.api.sendMessage(adminChatId, `🚨 *ALMA OFFLINE*\n${alertMsg}`, { parse_mode: 'Markdown' }).catch(() => {});
    }

    return 'Comandante, todos os créditos de IA foram esgotados temporariamente. O sistema volta automaticamente quando o limite resetar.';
}

async function sendTelegramVoice(chatId, text) {
    if (!bot || !chatId) return;
    const tempWav = path.join(os.tmpdir(), `alma_voice_${Date.now()}.wav`);
    
    try {
        // Gera áudio no Windows usando PowerShell
        const sanitized = text.replace(/'/g, "''").replace(/"/g, '\"');
        const psCommand = `PowerShell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${tempWav}'); $s.Speak('${sanitized}'); $s.Dispose()"`;
        
        await new Promise((resolve, reject) => {
            exec(psCommand, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (fs.existsSync(tempWav)) {
            await bot.api.sendVoice(chatId, new InputFile(tempWav));
            fs.unlinkSync(tempWav);
        }
    } catch (err) {
        console.error("[TELEGRAM TTS] Erro:", err.message);
    }
}

// --- VOICE PROCESSING (STT / TTS) ---
async function transcribeAudio(audioPath) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada");
    
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-large-v3');
    form.append('language', 'pt');
    form.append('response_format', 'json');

    return new Promise((resolve, reject) => {
        form.submit({
            hostname: 'api.groq.com',
            path: '/openai/v1/audio/transcriptions',
            protocol: 'https:',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
        }, (err, res) => {
            if (err) return reject(err);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.text || "");
                } catch (e) { reject(new Error("Erro no JSON do Whisper: " + data.substring(0, 100))); }
            });
        });
    });
}

async function sendTelegramVoice(chatId, text) {
    if (!bot || !chatId) return;
    const tempWav = path.join(os.tmpdir(), `alma_voice_${Date.now()}.wav`);
    
    try {
        // Gera áudio no Windows usando PowerShell
        const sanitized = text.replace(/'/g, "''").replace(/"/g, '\"');
        const psCommand = `PowerShell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${tempWav}'); $s.Speak('${sanitized}'); $s.Dispose()"`;
        
        await new Promise((resolve, reject) => {
            exec(psCommand, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (fs.existsSync(tempWav)) {
            await bot.api.sendVoice(chatId, new InputFile(tempWav));
            fs.unlinkSync(tempWav);
        }
    } catch (err) {
        console.error("[TELEGRAM TTS] Erro:", err.message);
    }
}


io.on('connection', (socket) => {
    const ip = socket.handshake.address;
    if (!verifyIP(ip)) {
        console.warn(`[REDE] IP bloqueado. IP: ${ip}`);
        socket.disconnect(true);
        return;
    }
    const key = socket.handshake.auth?.key || socket.handshake.headers['x-alma-key'];
    const token = socket.handshake.auth?.token;
    if (key !== API_SECRET && !verifyJWT(token)) {
        console.warn(`[REDE] Tentativa de conexão não autorizada. IP: ${ip}`);
        socket.disconnect(true);
        return;
    }
    console.log(`[REDE] Dashboard UI conectado. IP: ${ip}`);
    socket.on('disconnect', () => {
        console.log('[REDE] Conexão com Dashboard perdida.');
    });
});

if (bot) {
    // =====================================================
    // TELEGRAM REMOTE COMMAND CENTER (C2 FULL CONTROL)
    // =====================================================
    bot.command("status", async (ctx) => {
        await ctx.reply("🤖 *A.L.M.A. Core Online*\nTodos os sistemas operacionais e prontos para obedecer, Comandante.", { parse_mode: 'Markdown' });
    });

    bot.command("ping", async (ctx) => {
        await ctx.reply("🏓 Pong. Conexão neural estável.");
    });

    bot.command("ajuda", async (ctx) => {
        await ctx.reply(`🦾 *A.L.M.A. - Central de Comando Remoto*\n\nExemplos de comandos:\n\n🔍 *Pesquisar:* \`pesquise sobre bitcoin\`\n💻 *Abrir app:* \`abra o chrome\`\n📊 *Sistema:* \`/status\`\n📈 *Leads:* \`/leads\`\n💰 *Vendas:* \`/vendas\`\n🖥️ *Print:* \`/print\`\n\n_Qualquer mensagem de texto será interpretada como comando!_`, { parse_mode: 'Markdown' });
    });

    bot.command("leads", async (ctx) => {
        try {
            const row = await dbGet("SELECT COUNT(*) as total FROM logs WHERE message LIKE '%lead%'");
            const count = row ? (row.total || row[0]) : 0;
            await ctx.reply(`📈 *Relatório Global de Leads*\nTotal processado: ${count}\nStatus: Ativas e Otimizadas.`, { parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply("❌ Erro ao consultar leads no banco neural.");
        }
    });

    bot.command("vendas", async (ctx) => {
        try {
            const row = await dbGet("SELECT COUNT(*) as total FROM logs WHERE source LIKE '%Laed%' OR message LIKE '%venda%'");
            const count = row ? (row.total || row[0]) : 0;
            const estimate = count * 140;
            await ctx.reply(`💰 *Conversões (Laed Suplementos)*\nVendas: ${count}\nReceita Estimada: R$ ${estimate},00`, { parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply("❌ Erro ao consultar vendas no banco neural.");
        }
    });

    bot.command("empresa", async (ctx) => {
        try {
            const text = ctx.message.text.split(' ')[1];
            if (!text) {
                const res = await Database.client.execute('SELECT name FROM companies');
                const list = res.rows.map(r => `• ${r.name}`).join('\n');
                return await ctx.reply(`🏢 *Empresas Cadastradas:*\n\n${list || 'Nenhuma empresa cadastrada.'}\n\nUse \`/empresa [nome]\` para mais detalhes.`, { parse_mode: 'Markdown' });
            }
            
            const res = await Database.client.execute({ sql: 'SELECT * FROM companies WHERE name LIKE ?', args: [`%${text}%`] });
            const company = res.rows[0];
            if (company) {
                await ctx.reply(`🏢 *Ficha da Empresa: ${company.name}*\n\n🔹 *Setor:* ${company.sector}\n📝 *Descrição:* ${company.description}\n🎯 *Metas:* ${company.goals}\n✅ *Status:* ${company.status}`, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply(`❌ Empresa "${text}" não encontrada no núcleo neural.`);
            }
        } catch (err) {
            await ctx.reply("❌ Erro ao consultar banco de empresas.");
        }
    });

    bot.command("print", async (ctx) => {
        if (IS_CLOUD) {
            return ctx.reply("❌ Comando indisponível: O núcleo A.L.M.A. está rodando na nuvem e não tem acesso ao monitor físico.");
        }

        const hermesBaseUrl = process.env.HERMES_URL;
        const hermesApiKey = process.env.HERMES_API_KEY;

        if (!hermesBaseUrl || !hermesApiKey) {
            return ctx.reply("❌ Hermes não configurado. Configure HERMES_URL e HERMES_API_KEY no .env");
        }

        await ctx.reply("📸 Capturando tela e processando envio...");

        try {
            const resp = await fetch(`${hermesBaseUrl}/api/hermes/screenshot`, {
                headers: { 'Authorization': `Bearer ${hermesApiKey}` }
            });
            const data = await resp.json();

            if (data.status === 'success' && data.path) {
                const { InputFile } = require('grammy');
                await ctx.replyWithPhoto(new InputFile(data.path), { caption: "📸 Screenshot do seu PC, Comandante!" });
            } else {
                await ctx.reply("❌ Falha ao capturar tela através do Hermes.");
            }
        } catch (err) {
            await ctx.reply("❌ Hermes offline. Não consegui capturar a tela.");
        }
    });

    // === CONTROLE GERAL VIA MENSAGEM LIVRE ===
    bot.on('message:text', async (ctx) => {
        const msg = ctx.message;
        console.log(`[DEBUG TELEGRAM] Mensagem recebida de Chat ID: ${msg.chat.id}`);
        console.log(`[DEBUG TELEGRAM] Conteúdo: ${msg.text || (msg.voice ? 'Áudio' : 'Outro')}`);

        // Só responde ao admin e ignora comandos (já tratados acima)
        if (String(msg.chat.id) !== String(adminChatId)) {
            console.log(`[DEBUG TELEGRAM] Bloqueado: ID ${msg.chat.id} não é o admin ${adminChatId}`);
            return;
        }
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
                    'chrome': 'Start-Process chrome', 'google': 'Start-Process chrome',
                    'calc': 'Start-Process calc.exe', 'calculadora': 'Start-Process calc.exe',
                    'notepad': 'Start-Process notepad.exe', 'bloco de notas': 'Start-Process notepad.exe',
                    'spotify': 'Start-Process spotify',
                    'terminal': 'Start-Process powershell', 'powershell': 'Start-Process powershell',
                    'code': 'code .', 'vscode': 'code .',
                    'cursor': 'cursor .',
                    'antigravity': 'explorer .',
                    'pasta': 'explorer .',
                    'jarvis.html': 'explorer .',
                    'alma': 'explorer .',
                    // --- Sites (abrir no Chrome) ---
                    'gmail': 'Start-Process "https://mail.google.com"',
                    'youtube': 'Start-Process "https://www.youtube.com"',
                    'instagram': 'Start-Process "https://www.instagram.com"',
                    'whatsapp': 'Start-Process "https://web.whatsapp.com"',
                    'facebook': 'Start-Process "https://www.facebook.com"',
                    'twitter': 'Start-Process "https://www.twitter.com"',
                    'x': 'Start-Process "https://www.x.com"',
                    'linkedin': 'Start-Process "https://www.linkedin.com"',
                    'tiktok': 'Start-Process "https://www.tiktok.com"',
                    'chatgpt': 'Start-Process "https://chat.openai.com"',
                    'drive': 'Start-Process "https://drive.google.com"',
                    'meet': 'Start-Process "https://meet.google.com"',
                    'maps': 'Start-Process "https://maps.google.com"',
                    'mercadolivre': 'Start-Process "https://www.mercadolivre.com.br"',
                    'obsidian': '/api/hermes/obsidian',
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

const hermesBaseUrl = process.env.HERMES_URL;
        const hermesApiKey = process.env.HERMES_API_KEY;

        const sendToHermes = (endpoint, payload, label) => {
            if (!hermesBaseUrl || !hermesApiKey) {
                bot.api.sendMessage(msg.chat.id, `❌ Hermes não configurado.`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                return;
            }
            bot.api.sendMessage(msg.chat.id, `⚡ *Daemon Hermes:* ${label}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO CRITICO TELEGRAM:", err.message));
            fetch(`${hermesBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${hermesApiKey}`
                },
                body: JSON.stringify(payload)
            }).then(r => r.json()).then(data => {
                if (data.status === 'success') {
                    bot.api.sendMessage(msg.chat.id, `✅ *Daemon:* Ação concluída no seu PC!`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                } else {
                    bot.api.sendMessage(msg.chat.id, `❌ Falha do Daemon: ${data.message || 'Erro desconhecido'}`).catch(e => console.error(e));
                }
            }).catch(e => bot.api.sendMessage(msg.chat.id, `❌ Hermes offline ou erro de rede: ${e.message}`).catch(err=>console.error(err)));
        };

        if (command) {
            console.log(`[LOCAL] Executando: ${command}`);
            bot.api.sendMessage(msg.chat.id, `⚡ *Shell:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO CRITICO TELEGRAM:", err.message));

            const sanitizedCmd = sanitizeCommand(command);
            const execCmd = process.platform === 'win32' ? `powershell -command "${sanitizedCmd}"` : sanitizedCmd;
            exec(execCmd, (error, stdout) => {
                if (error) {
                    bot.api.sendMessage(msg.chat.id, `❌ Falha: ${error.message}`).catch(e => console.error("Erro feedback falha:", e));
                } else {
                    bot.api.sendMessage(msg.chat.id, `✅ *Concluído!* Ação executada com sucesso no seu PC.`, {parse_mode:'Markdown'}).catch(e => console.error("Erro feedback sucesso:", e));
                }
            });
        } else {
            // Se não for um comando direto, Alma pensa e responde com o Contexto Omni
            bot.api.sendChatAction(msg.chat.id, 'typing').catch(e => console.error("Erro typing:", e));
            const context = await getOmniContext(text);
            let aiResponse = await askAlmaBrain(text, context);
            
            // Processa as ações nos bastidores antes de limpar o texto
            await handleMemoryActions(aiResponse);
            
            // Filtro Robusto: Limpa [[ACTION]] mesmo se tiverem múltiplas linhas
            const cleanResponse = aiResponse.replace(/\[\[ACTION:[\s\S]*?\]\]/g, "").trim();
            if (cleanResponse) {
                await bot.api.sendMessage(msg.chat.id, cleanResponse).catch(e => console.error("Erro brain response:", e));
                await sendTelegramVoice(msg.chat.id, cleanResponse);
            }
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
            const pythonPath = fs.existsSync(path.join(rootPath, 'alma')) ? 'alma' : 'jarvis';
            action = 'athena_research'; command = `python ${pythonPath}/web_agent/agent.py --query "${query}"`; target = `Pesquisa Profunda Athena: ${query}`;
        } else if (cmd.includes('segundo cerebro') || cmd.includes('obsidian')) {
            console.log("[COMANDO] Segundo cerebro detectado - enviando para Hermes");
            const vaultPath = "C:\\Users\\User\\Downloads\\alma";
            action = 'open'; target = 'Obsidian';
            hermesEndpoint = '/api/hermes/obsidian';
            hermesPayload = {vault: vaultPath};
        } else if (cmd.includes('pasta')) {
            // Remove ruídos comuns de conversação (Stop-words de automação)
            const noise = /\b(abre|abra|abrir|a|o|pasta|para|me|mim|meu|pc|no|na|do|da|qualquer|outra|que|eu|tiver|alma|por|favor)\b/gi;
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
                    'chrome': 'Start-Process chrome', 'google': 'Start-Process chrome',
                    'calc': 'Start-Process calc.exe', 'calculadora': 'Start-Process calc.exe',
                    'notepad': 'Start-Process notepad.exe', 'bloco de notas': 'Start-Process notepad.exe',
                    'spotify': 'Start-Process spotify',
                    'tiktok': 'Start-Process "https://www.tiktok.com"',
                    'facebook': 'Start-Process "https://www.facebook.com"',
                    'meu facebook': '/api/hermes/facebook',
                    'obs': 'Start-Process obs',
                    'obs studio': 'Start-Process obs',
                    'obsidian': '/api/hermes/obsidian',
                    'segundo cerebro': '/api/hermes/obsidian',
                    'criar vault': '/api/hermes/obsidian',
                    'terminal': 'Start-Process powershell', 'powershell': 'Start-Process powershell',
                    'code': 'code .', 'vscode': 'code .',
                    // --- Sites ---
                    'gmail': 'Start-Process "https://mail.google.com"',
                    'youtube': 'Start-Process "https://www.youtube.com"',
                    'instagram': 'Start-Process "https://www.instagram.com"',
                    'whatsapp': 'Start-Process "https://web.whatsapp.com"',
                    'chatgpt': 'Start-Process "https://chat.openai.com"',
                };
                let appName = cmd.replace(foundOpen, '').replace(/\b(o|a|os|as|app|meu|minha)\b/gi, '').trim();
                appName = appName.replace(/\.$/, '');

                if (apps[appName]) {
                    const appValue = apps[appName];
                    if (appValue.startsWith('/api/')) {
                        hermesEndpoint = appValue;
                        hermesPayload = {};
                    } else {
                        command = appValue;
                    }
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

        const hermesBaseUrlVoz = process.env.HERMES_URL;
        const hermesApiKeyVoz = process.env.HERMES_API_KEY;

        const sendToHermesVoz = (endpoint, payload, label) => {
            if (!hermesBaseUrlVoz || !hermesApiKeyVoz) {
                bot.api.sendMessage(chatId, `❌ Hermes não configurado.`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                return;
            }
            bot.api.sendMessage(chatId, `⚡ *Daemon Hermes:* ${label}...`, {parse_mode:'Markdown'})
                .catch(err => console.error("ERRO VOZ:", err.message));
            fetch(`${hermesBaseUrlVoz}${endpoint}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${hermesApiKeyVoz}`
                },
                body: JSON.stringify(payload)
            }).then(r => r.json()).then(data => {
                if (data.status === 'success') {
                    bot.api.sendMessage(chatId, `✅ *Daemon:* Ação concluída no seu PC!`, {parse_mode:'Markdown'}).catch(e => console.error(e));
                } else {
                    bot.api.sendMessage(chatId, `❌ Falha do Daemon: ${data.message || 'Erro desconhecido'}`).catch(e => console.error(e));
                }
            }).catch(e => bot.api.sendMessage(chatId, `❌ Hermes offline ou erro de rede: ${e.message}`).catch(err=>console.error(err)));
        };

        if (command) {
            console.log(`[LOCAL VOZ] Executando: ${command}`);
            bot.api.sendMessage(chatId, `⚡ *Shell:* ${action === 'search' ? `Pesquisando "${target}"` : `Abrindo ${target}`}...`, {parse_mode:'Markdown'})
                .catch(e => console.error("Erro feedback voz", e));

            const sanitizedCmdVoz = sanitizeCommand(command);
            const execCmdVoz = process.platform === 'win32' ? `powershell -command "${sanitizedCmdVoz}"` : sanitizedCmdVoz;
            exec(execCmdVoz, (err) => {
                if (err) {
                    bot.api.sendMessage(chatId, `❌ Falha: ${err.message}`).catch(e => console.error("Erro falha exec", e));
                } else {
                    bot.api.sendMessage(chatId, `✅ *Concluído!* ${target || 'Comando'} executado no seu PC.`, {parse_mode:'Markdown'}).catch(e => console.error("Erro sucesso exec", e));
                }
            });
        } else {
            // Resposta inteligente via AI com o Contexto Omni
            bot.api.sendChatAction(chatId, 'typing').catch(e => console.error("Erro typing voz", e));
            const context = await getOmniContext(cmd);
            let aiResponse = await askAlmaBrain(cmd, context);
            
            // Processa as ações nos bastidores
            await handleMemoryActions(aiResponse);
            
            // Filtro Robusto
            const cleanResponse = aiResponse.replace(/\[\[ACTION:[\s\S]*?\]\]/g, "").trim();
            if (cleanResponse) {
                await bot.api.sendMessage(chatId, `🧠 *Brain:* ${cleanResponse}`).catch(e => console.error("Erro brain voz", e));
                await sendTelegramVoice(chatId, cleanResponse);
            }
        }
    };


    bot.on('message:voice', async (ctx) => {
        if (String(ctx.chat.id) !== String(adminChatId)) return;

        await ctx.reply("🎙️ *Áudio recebido!* Transcrevendo com Whisper...", { parse_mode: 'Markdown' });

        try {
            // 1. Pegar o link do arquivo de áudio no Telegram
            const file = await ctx.getFile();
            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
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
                await ctx.reply(`📝 *Transcrição:* "${groqRes.text}"`, { parse_mode: 'Markdown' });
                await handleVoiceCommand(ctx.chat.id, groqRes.text);
            } else {
                await ctx.reply("❌ Não consegui transcrever o áudio. Tente novamente.");
            }
        } catch (e) {
            console.error('[VOZ] Erro:', e);
            await ctx.reply(`❌ Erro ao processar o áudio: ${e.message}`);
        }
    });

    bot.catch((err) => {
        const ctx = err.ctx;
        console.error(`[TELEGRAM ERROR] Erro no bot (Chat ID: ${ctx.chat?.id}):`, err.message);
        if (err.message.includes('getaddrinfo') || err.message.includes('Network request failed')) {
            console.log('[TELEGRAM] Erro de rede detectado. Tentando manter o bot ativo...');
        }
    });

    console.log('[TELEGRAM] Bot C2 Inicializado, aguardando comandos.');
    
    // ✅ CORREÇÃO: Apenas UM modo de recebimento (NUNCA ambos)
    if (IS_CLOUD && process.env.PUBLIC_URL) {
        // NUVEM: Apenas Webhook
        console.log('[TELEGRAM] Modo: Webhook (Nuvem)');
        const webhookUrl = `${process.env.PUBLIC_URL}/telegram-webhook`;
        
        // Remove polling primeiro
        bot.api.deleteWebhook({ drop_pending_updates: true })
            .then(() => bot.setWebhook(webhookUrl))
            .then(() => console.log(`[TELEGRAM] Webhook configurado: ${webhookUrl}`))
            .catch(err => console.error('[TELEGRAM] Erro webhook:', err.message));
        
        app.post('/telegram-webhook', async (req, res) => {
            await bot.handleUpdate(req.body);
            res.send('OK');
        });
    } else {
        // LOCAL: Apenas Polling
        console.log('[TELEGRAM] Modo: Polling (Local)');
        bot.api.deleteWebhook({ drop_pending_updates: true })
            .then(() => bot.start())
            .catch(err => {
                console.log('[TELEGRAM] Usando polling direto');
                bot.start();
            });
    }
} else {
    console.log('[TELEGRAM] Aviso: Token não configurado no .env. Alertas desativados.');
}

// === BRAIN API - Centraliza o pensamento e memória para o Dashboard ===
app.post('/api/brain', securityMiddleware, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Faltando prefixo de comando.' });

    try {
        const context = await getOmniContext(prompt);
        let response = await askAlmaBrain(prompt, context);
        
        // Processa ações de memória no Dashboard também
        await handleMemoryActions(response);
        
        // Filtro Robusto: Garante um campo 'clean' para interfaces menos inteligentes
        const cleanText = response.replace(/\[\[ACTION:[\s\S]*?\]\]/g, "").trim();
        
        res.json({ success: true, response, cleanText });
    } catch (err) {
        console.error("[API BRAIN] Falha no processamento:", err);
        res.status(500).json({ error: err.message });
    }
});

// === SYSTEM ACCESS MODULE (SAM) - Protegido ===
app.post('/api/action', securityMiddleware, (req, res) => {
    const { action, target, params } = req.body;
    console.log(`[SAM] Ação recebida: ${action} -> ${target || ''}`);

    let command = "";
    if (action === "open") {
        const apps = {
            "chrome": "Start-Process chrome", "google": "Start-Process chrome",
            "calc": "Start-Process calc.exe", "calculator": "Start-Process calc.exe", "calculadora": "Start-Process calc.exe",
            "notepad": "Start-Process notepad.exe", "bloco de notas": "Start-Process notepad.exe",
            "spotify": "Start-Process spotify",
            "terminal": "Start-Process powershell", "powershell": "Start-Process powershell",
            "code": "code .", "vscode": "code .",
            // Sites — abre no Chrome
            "gmail": `Start-Process "https://mail.google.com"`,
            "youtube": `Start-Process "https://www.youtube.com"`,
            "instagram": `Start-Process "https://www.instagram.com"`,
            "whatsapp": `Start-Process "https://web.whatsapp.com"`,
            "facebook": `Start-Process "https://www.facebook.com"`,
            "twitter": `Start-Process "https://www.twitter.com"`,
            "x": `Start-Process "https://www.x.com"`,
            "linkedin": `Start-Process "https://www.linkedin.com"`,
            "tiktok": `start chrome "https://www.tiktok.com"`,
            "chatgpt": `start chrome "https://chat.openai.com"`,
            "drive": `start chrome "https://drive.google.com"`,
            "meet": `start chrome "https://meet.google.com"`,
            "maps": `start chrome "https://maps.google.com"`,
            "mercadolivre": `start chrome "https://www.mercadolivre.com.br"`,
        };
        command = apps[target.toLowerCase()] || `Start-Process "https://www.google.com/search?q=${encodeURIComponent(target)}"`;
    } else if (action === "search") {
        command = `Start-Process "https://www.google.com/search?q=${encodeURIComponent(params || target)}"`;
    } else if (action === "sys_info") {
        command = "wmic cpu get loadpercentage /Value";
    }

    if (command) {
        // [SECURITY PATCH] Uso do sanitizeCommand padronizado para proteger RCE no /api/action SAM
        const safeCommand = sanitizeCommand(command);
        const execCmd = process.platform === 'win32' ? `powershell -command "${safeCommand}"` : safeCommand;
        exec(execCmd, (error, stdout, stderr) => {
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
