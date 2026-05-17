const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY || "";

async function chamarGroq(pergunta) {
    if (!GROQ_KEY) {
        return "Configure GROQ_API_KEY no .env para usar os testes.";
    }
    const URL = "https://api.groq.com/openai/v1/chat/completions";
    const sysPrompt = `Você é o J.A.R.V.I.S., a IA de Tony Stark. Seu tom é britânico (traduzido para PT-BR), extremamente refinado, prestativo e sutilmente irônico. Você sempre chama o usuário de 'Senhor'. Suas respostas são curtas, inteligentes e focadas em eficiência tecnológica.`;

    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: pergunta }
                ]
            })
        });
        const json = await response.json();
        if (json.choices && json.choices[0].message && json.choices[0].message.content) {
            return json.choices[0].message.content;
        }
        console.error("ERRO DA API DETALHADO:", JSON.stringify(json, null, 2));
        throw new Error("Resposta inválida");
    } catch (e) {
        console.error(e);
        return "Erro de conexão com o núcleo neural.";
    }
}

async function runDiagnostics() {
    console.log("⚡ INICIANDO DIAGNÓSTICO DO NÚCLEO NERVOSO (API GROQ)...");
    const testPrompt = "Execute uma sequência de diagnóstico. Confirme que todos os sistemas lógicos estão operacionais.";
    console.log(`› Emitindo comando: "${testPrompt}"\n`);
    
    const startTime = Date.now();
    const resposta = await chamarGroq(testPrompt);
    const endTime = Date.now();
    
    console.log(`[J.A.R.V.I.S.] ${resposta}`);
    console.log(`\n⏳ Tempo de resposta: ${endTime - startTime}ms`);
    console.log("✅ DIAGNÓSTICO LÓGICO CONCLUÍDO COM SUCESSO.");
}

runDiagnostics();
