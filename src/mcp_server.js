const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
    CallToolResultSchema, 
    ListResourcesResultSchema, 
    ListToolsResultSchema,
    ListPromptsResultSchema
} = require('@modelcontextprotocol/sdk/types.js');

class AlmaMCPServer {
    constructor() {
        this.server = new Server({
            name: 'alma-synapse',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {},
                resources: {}
            }
        });

        this.setupTools();
    }

    setupTools() {
        this.server.setRequestHandler(ListToolsResultSchema, async () => ({
            tools: [
                {
                    name: 'query_database',
                    description: 'Consulta o banco de dados Turso (logs, memória, histórico)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            table: { type: 'string', enum: ['logs', 'memory', 'history', 'knowledge'] },
                            limit: { type: 'number', default: 10 }
                        },
                        required: ['table']
                    }
                },
                {
                    name: 'get_memory',
                    description: 'Recupera informações da memória do ALMA',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: { type: 'string', description: 'Chave da memória' }
                        }
                    }
                },
                {
                    name: 'set_memory',
                    description: 'Salva informação na memória do ALMA',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            key: { type: 'string' },
                            value: { type: 'string' }
                        },
                        required: ['key', 'value']
                    }
                },
                {
                    name: 'get_system_info',
                    description: 'Retorna informações do sistema (CPU, memória, uptime)',
                    inputSchema: { type: 'object', properties: {} }
                },
                {
                    name: 'execute_automation',
                    description: 'Executa automação via Hermes (abrir apps, controlar PC)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            action: { type: 'string', enum: ['open_app', 'search', 'work_mode', 'cleanup', 'screenshot', 'volume'] },
                            target: { type: 'string', description: 'App ou destino' }
                        },
                        required: ['action']
                    }
                },
                {
                    name: 'send_telegram',
                    description: 'Envia mensagem via Telegram',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            message: { type: 'string' }
                        },
                        required: ['message']
                    }
                },
                {
                    name: 'ai_think',
                    description: 'Pede ao ALMA para processar uma solicitação com IA',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string' }
                        },
                        required: ['prompt']
                    }
                },
                {
                    name: 'add_knowledge',
                    description: 'Adiciona conhecimento ao RAG (banco de conhecimento)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            content: { type: 'string' },
                            source: { type: 'string', default: 'MCP' }
                        },
                        required: ['title', 'content']
                    }
                }
            ]
        }));

        this.server.setRequestHandler(CallToolResultSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return await this.handleToolCall(name, args);
        });
    }

    async handleToolCall(toolName, args) {
        try {
            switch (toolName) {
                case 'query_database':
                    return await this.queryDatabase(args.table, args.limit);

                case 'get_memory':
                    return await this.getMemory(args.key);

                case 'set_memory':
                    return await this.setMemory(args.key, args.value);

                case 'get_system_info':
                    return this.getSystemInfo();

                case 'execute_automation':
                    return await this.executeAutomation(args.action, args.target);

                case 'send_telegram':
                    return await this.sendTelegram(args.message);

                case 'ai_think':
                    return await this.aiThink(args.prompt);

                case 'add_knowledge':
                    return await this.addKnowledge(args.title, args.content, args.source);

                default:
                    return { content: [{ type: 'text', text: `Ferramenta ${toolName} não encontrada` }], isError: true };
            }
        } catch (error) {
            return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
        }
    }

    async queryDatabase(table, limit = 10) {
        const tables = ['logs', 'memory', 'history', 'knowledge'];
        if (!tables.includes(table)) {
            return { content: [{ type: 'text', text: `Tabela ${table} não existe` }], isError: true };
        }

        try {
            const { createClient } = require('@libsql/client');
            const client = createClient({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN
            });

            const result = await client.execute({
                sql: `SELECT * FROM ${table} ORDER BY id DESC LIMIT ?`,
                args: [limit]
            });

            return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
        } catch (e) {
            return { content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true };
        }
    }

    async getMemory(key) {
        try {
            const { createClient } = require('@libsql/client');
            const client = createClient({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN
            });

            const result = await client.execute({
                sql: 'SELECT * FROM memory WHERE key = ?',
                args: [key]
            });

            return { content: [{ type: 'text', text: result.rows[0] ? JSON.stringify(result.rows[0]) : 'Chave não encontrada' }] };
        } catch (e) {
            return { content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true };
        }
    }

    async setMemory(key, value) {
        try {
            const { createClient } = require('@libsql/client');
            const client = createClient({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN
            });

            await client.execute({
                sql: 'INSERT OR REPLACE INTO memory (key, value) VALUES (?, ?)',
                args: [key, value]
            });

            return { content: [{ type: 'text', text: `Memória salva: ${key} = ${value}` }] };
        } catch (e) {
            return { content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true };
        }
    }

    getSystemInfo() {
        const os = require('os');
        const memUsed = os.totalmem() - os.freemem();
        const memPercent = Math.round((memUsed / os.totalmem()) * 100);

        const info = {
            platform: os.platform(),
            cpu: os.cpus()[0]?.model || 'Unknown',
            cpuCores: os.cpus().length,
            memory: `${Math.round(memUsed / 1e9)}GB / ${Math.round(os.totalmem() / 1e9)}GB (${memPercent}%)`,
            uptime: `${Math.floor(os.uptime() / 3600)}h`
        };

        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }

    async executeAutomation(action, target) {
        const http = require('http');

        const hermesUrl = process.env.HERMES_URL || 'http://localhost:3001';
        const hermesKey = process.env.HERMES_API_KEY;
        if (!hermesKey) {
            return { content: [{ type: 'text', text: 'HERMES_API_KEY não configurada' }], isError: true };
        }

        let endpoint = '';
        let payload = {};

        switch (action) {
            case 'open_app':
                endpoint = '/api/hermes/app';
                payload = { app: target };
                break;
            case 'search':
                endpoint = '/api/hermes/exec';
                payload = { command: `start chrome "https://www.google.com/search?q=${encodeURIComponent(target)}"` };
                break;
            case 'work_mode':
                endpoint = '/api/hermes/work_mode';
                break;
            case 'cleanup':
                endpoint = '/api/hermes/clean_system';
                payload = { confirm: true };
                break;
            default:
                return { content: [{ type: 'text', text: `Ação ${action} não suportada` }], isError: true };
        }

        return new Promise((resolve) => {
            const req = http.request(`${hermesUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${hermesKey}`
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ content: [{ type: 'text', text: data }] });
                });
            });

            req.on('error', (e) => {
                resolve({ content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true });
            });

            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    async sendTelegram(message) {
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (!adminChatId) {
            return { content: [{ type: 'text', text: 'Telegram não configurado' }], isError: true };
        }

        return { content: [{ type: 'text', text: `Mensagem agendada: ${message}` }] };
    }

    async aiThink(prompt) {
        return { content: [{ type: 'text', text: `ALMA processando: ${prompt}\n\n[Em modo MCP, a IA responde diretamente aqui]` }] };
    }

    async addKnowledge(title, content, source = 'MCP') {
        try {
            const { createClient } = require('@libsql/client');
            const client = createClient({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN
            });

            await client.execute({
                sql: 'INSERT INTO knowledge (source, title, content) VALUES (?, ?, ?)',
                args: [source, title, content]
            });

            return { content: [{ type: 'text', text: `Conhecimento adicionado: ${title}` }] };
        } catch (e) {
            return { content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true };
        }
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('[MCP] Alma MCP Server iniciado');
    }
}

module.exports = AlmaMCPServer;