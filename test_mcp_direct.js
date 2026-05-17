const AlmaMCPServer = require('./src/mcp_server.js');

async function test() {
    const server = new AlmaMCPServer();

    console.log('=== Teste get_system_info ===');
    const sys = await server.handleToolCall('get_system_info', {});
    console.log(sys.content[0].text);

    console.log('\n=== Teste ai_think ===');
    const think = await server.handleToolCall('ai_think', { prompt: 'Qual a capital do Brasil?' });
    console.log(think.content[0].text);

    console.log('\n=== Teste send_telegram ===');
    const tg = await server.handleToolCall('send_telegram', { message: 'teste do MCP' });
    console.log(tg.content[0].text);

    console.log('\n✅ MCP funcionando!');
}

test();