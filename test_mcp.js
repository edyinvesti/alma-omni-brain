const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testMCP() {
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['src/mcp_server.js']
    });

    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log('✓ Conectado ao MCP server');

        const toolsResult = await client.request('tools/list', {});
        console.log(`✓ Tools disponíveis: ${toolsResult.tools.length}`);
        toolsResult.tools.forEach(t => console.log(`  - ${t.name}`));

        const sysInfo = await client.request('tools/call', {
            name: 'get_system_info',
            arguments: {}
        });
        console.log('✓ get_system_info:', sysInfo.content[0].text);

        await client.close();
        console.log('✓ Teste concluído!');
    } catch (e) {
        console.error('Erro:', e.message);
        process.exit(1);
    }
}

testMCP();