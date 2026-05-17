const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { EventEmitter } = require('events');

class AlmaMCPClient extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map();
        this.toolsCache = new Map();
    }

    async connect(name, command, args = []) {
        try {
            const transport = new StdioClientTransport({
                command,
                args
            });

            const client = new Client({
                name: `alma-${name}`,
                version: '1.0.0'
            }, {
                capabilities: {}
            });

            await client.connect(transport);

            const tools = await this.listTools(client);

            this.clients.set(name, { client, transport, tools });
            this.toolsCache.set(name, tools);

            console.log(`[MCP Client] Conectado a ${name} com ${tools.length} ferramentas`);
            return { success: true, tools: tools.length };
        } catch (e) {
            console.error(`[MCP Client] Erro ao conectar em ${name}:`, e.message);
            return { success: false, error: e.message };
        }
    }

    async listTools(client) {
        try {
            const result = await client.request('tools/list', {});
            return result.tools || [];
        } catch (e) {
            console.error('[MCP] Erro ao listar tools:', e.message);
            return [];
        }
    }

    async callTool(serverName, toolName, args = {}) {
        const server = this.clients.get(serverName);
        if (!server) {
            return { error: `Servidor ${serverName} não conectado` };
        }

        try {
            const result = await server.client.request('tools/call', {
                name: toolName,
                arguments: args
            });
            return result;
        } catch (e) {
            return { error: e.message };
        }
    }

    getAvailableTools() {
        const tools = {};
        for (const [name, server] of this.clients) {
            tools[name] = server.tools.map(t => t.name);
        }
        return tools;
    }

    async disconnect(name) {
        const server = this.clients.get(name);
        if (server) {
            await server.client.close();
            this.clients.delete(name);
            this.toolsCache.delete(name);
            console.log(`[MCP Client] Desconectado de ${name}`);
        }
    }

    async disconnectAll() {
        for (const name of this.clients.keys()) {
            await this.disconnect(name);
        }
    }
}

// Servidores MCP externos populares para conectar
const EXTERNAL_MCP_SERVERS = {
    'filesystem': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/home']
    },
    'github': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github']
    },
    'brave-search': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search']
    }
};

module.exports = { AlmaMCPClient, EXTERNAL_MCP_SERVERS };