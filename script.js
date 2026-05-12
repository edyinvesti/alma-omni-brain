const CORE_TELEMETRY_URL = "http://localhost:3000";
const GROQ_KEY = "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"; 
let userName = localStorage.getItem('alma_user_name') || "Senhor";

window.onload = () => {
    updateTime();
    setInterval(updateTime, 1000);
    initCharts();
    initTelemetryStream();
    initVoiceCommand();
    setupInteractions();
    speak("Sistemas centrais online e estabilizados, Senhor.");
};

function updateTime() {
    const timeEl = document.getElementById('datetime');
    if (timeEl) {
        const now = new Date();
        const str = now.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) + " | " + now.toLocaleTimeString('en-US', {hour12:false}) + " UTC";
        timeEl.textContent = str.toUpperCase();
    }
}

function initTelemetryStream() {
    if (typeof io !== 'undefined') {
        const socket = io(CORE_TELEMETRY_URL);
        
        socket.on("connect", () => {
            // Silêncio na ponte de telemetria
        });

        socket.on("new_log", (data) => {
            addLog(data.message, data.source, data.timestamp);
        });

        socket.on("disconnect", () => {
            // Silêncio no alerta de desconexão
        });
    }
}

function addLog(msg, source = "SYSTEM", timestamp = null) {
    const log = document.getElementById('log-scroll');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'log-entry';
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR');
    d.innerHTML = `<span class="log-time">[${timeStr}]</span><span class="log-source">[${source}]</span> <span style="color:#fff;">${msg}</span>`;
    log.insertBefore(d, log.firstChild);
}

async function toggleTerminal() {
    const t = document.getElementById('terminal-overlay');
    const input = document.getElementById('cmd-input');
    
    if(!t) return;

    if(t.classList.contains('hidden')) {
        t.classList.remove('hidden');
        input.focus();
    } else {
        // Se já está aberto e o input está vazio, fecha tudo
        if (!input.value.trim()) {
            t.classList.add('hidden');
            const logHistory = document.getElementById('log-history');
            if (logHistory) logHistory.classList.add('hidden');
            return;
        }
    }
    
    // Sempre prioriza gatilho de VOZ ao interagir com o núcleo
    triggerVoice();
}

function toggleLogs() {
    const logHistory = document.getElementById('log-history');
    if (logHistory) {
        logHistory.classList.toggle('hidden');
        if (!logHistory.classList.contains('hidden')) {
            addLog("Acesso ao histórico de telemetria.", "UI");
        }
    }
}

async function processCommand(text) {
    addLog(text, "COMANDANTE");
    const resposta = await chamarBrainServer(text);
    
    // Parse de Ações (SAM)
    const actionMatch = resposta.match(/\[\[ACTION: (.*?)\]\]/);
    if (actionMatch) {
        try {
            const actionData = JSON.parse(actionMatch[1]);
            executeSAMAction(actionData);
        } catch(e) {
            console.error("Erro ao processar ação SAM:", e);
        }
    }

    const cleanResposta = resposta.replace(/\[\[ACTION:.*?\]\]/g, "").trim();
    addLog(cleanResposta, "A.L.M.A.");
    speak(cleanResposta);
}

async function executeSAMAction(data) {
    try {
        const res = await fetch(`${CORE_TELEMETRY_URL}/api/action`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-alma-key': 'alma_secret_2026'
            },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            const errText = await res.text();
            addLog(`Falha na API SAM (${res.status}): ${errText.substring(0, 50)}`, "ERRO");
            return;
        }

        const result = await res.json();
        if(result.success) {
            addLog(`Executando diretriz: ${data.action} ${data.target || data.params || ''}`, "SAM");
        } else {
            addLog(`Erro SAM: ${result.error}`, "SAM");
        }
    } catch(e) {
        console.error("Erro na ponte SAM:", e);
        addLog("Interrupção no Uplink SAM.", "ERRO");
    }
}

async function handleInput(e) {
    if(e.key === 'Enter'){
        const text = e.target.value.trim();
        if(text) {
            e.target.value = '';
            updateActionBtn(); // Reseta ícone para Mic
            await processCommand(text);
        }
    }
}

function updateActionBtn() {
    const input = document.getElementById('cmd-input');
    const btnIcon = document.getElementById('action-icon');
    const btn = document.getElementById('input-action-btn');
    
    if (input.value.trim().length > 0) {
        btnIcon.textContent = '➡️'; // Ícone de Enviar
        btn.title = "Enviar comando de texto";
    } else {
        btnIcon.textContent = '🎙️'; // Ícone de Microfone
        btn.title = "Mudar para comando de voz";
    }
}

async function handleActionBtnClick() {
    const input = document.getElementById('cmd-input');
    const text = input.value.trim();
    
    if (text) {
        // Enviar Texto
        input.value = '';
        updateActionBtn(); // Volta para Mic
        await processCommand(text);
    } else {
        // Iniciar Voz
        triggerVoice();
    }
}

// Interatividade de Componentes (Visual + Áudio)
function setupInteractions() {
    // Widgets HUD
    const widgets = document.querySelectorAll('.hud-widget');
    widgets.forEach(widget => {
        widget.style.cursor = 'pointer';
        widget.addEventListener('click', () => {
            const header = widget.querySelector('.hud-widget-header');
            if(header) {
                const title = header.textContent.trim();
                speak(`Acessando matriz de dados: ${title}. Integridade do fluxo em 100%.`);
            }
        });
    });

    // Clique no Título Central
    const centerTitle = document.querySelector('.hud-center-title');
    if(centerTitle) {
        centerTitle.style.cursor = 'pointer';
        centerTitle.addEventListener('click', () => speak("Interface Neural de Quarta Geração ativa, Senhor."));
    }
}

// Reconhecimento de Voz (Microfone)
let recognition;
function initVoiceCommand() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = function() {
            document.querySelectorAll('.core-center-glow').forEach(el => el.style.opacity = "0.8");
            document.querySelectorAll('.ring').forEach(el => {
                el.style.borderColor = "var(--c2)";
                el.style.boxShadow = "0 0 30px var(--c2)";
            });
        };

        recognition.onend = function() {
            document.querySelectorAll('.core-center-glow').forEach(el => el.style.opacity = "0.3");
            document.querySelectorAll('.ring').forEach(el => {
                el.style.borderColor = "";
                el.style.boxShadow = "";
            });
        };

        recognition.onresult = async function(event) {
            const rawTranscript = event.results[0][0].transcript;
            const transcript = rawTranscript.toLowerCase();
            addLog(rawTranscript, "COMANDANTE (Voz)");
            speak("Entendido. Processando diretriz.", false); // Não reinicia aqui
            
            // === MÓDULO DE OBEDIÊNCIA A COMANDOS FÍSICOS === //
            if (transcript.includes("atualizar") || transcript.includes("recarregar painel")) {
                speak("Comando recebido. Atualizando todos os sistemas, Senhor.");
                setTimeout(() => window.location.reload(), 3000);
                return;
            }
            if (transcript.includes("fechar") || transcript.includes("esconder tela") || transcript.includes("ocultar")) {
                speak("Ocultando telemetria. Fico no aguardo, Comandante.");
                const t = document.getElementById('terminal-overlay');
                if(t && !t.classList.contains('hidden')) {
                    t.classList.add('hidden');
                }
                return;
            }
            if (transcript.includes("alerta") || transcript.includes("bloquear") || transcript.includes("invasão") || transcript.includes("ameaça")) {
                speak("Atenção máxima. Modo Defesa Operacional ativado. Identificando e isolando a ameaça agora!");
                document.body.style.background = "radial-gradient(circle at center, #2e0000 0%, #0a0000 100%)";
                document.querySelectorAll('.core-center-glow').forEach(el => el.style.boxShadow = "0 0 100px #ff3b55, inset 0 0 60px #ff3b55");
                setTimeout(() => {
                    document.body.style.background = "";
                    document.querySelectorAll('.core-center-glow').forEach(el => el.style.boxShadow = "");
                    speak("Ameaça suprimida. Retornando os servidores ao status de paz.");
                }, 8000);
                return;
            }
            if (transcript.includes("tocar música") || transcript.includes("ligar som")) {
                speak("Iniciando rotina de relaxamento, Senhor. (Música desativada no front-end por enquanto, mas comando interpretado!)");
                return;
            }
            
            // Envia para processCommand que vai chamar a IA E executar as ações SAM:
            await processCommand(rawTranscript);
        };

        recognition.onerror = function(event) {
            let errorMsg = "Falha na interceptação neural de áudio.";
            let voiceError = "Houve um erro no microfone.";
            
            if (event.error === 'not-allowed') {
                errorMsg = "Acesso ao microfone negado. Verifique as permissões do navegador.";
                voiceError = "Acesso ao microfone negado. Por favor, autorize nas configurações.";
            } else if (event.error === 'network') {
                errorMsg = "Erro de rede no reconhecimento de voz.";
                voiceError = "Erro de rede ao processar voz.";
            } else if (event.error === 'no-speech') {
                return; // Silêncio apenas, ignorar
            }

            if (window.location.protocol === 'file:') {
                errorMsg += " DICA: Use http://localhost:3000";
                voiceError = "Senhor, você está usando o protocolo de arquivo. Por favor, use o servidor localhost porta 3000.";
            }
            addLog(errorMsg, "ERRO MIC");
            speak(voiceError, false); // Não reinicia em erro
            console.error("Erro Mic:", event.error);
        };
    } else {
        addLog("Navegador atual carece do módulo SpeechRecognition.", "SISTEMA");
    }
}

let micActive = false;
function triggerVoice() {
    if(!recognition) {
        initVoiceCommand();
    }
    
    try {
        recognition.start();
    } catch(e) {
        // Se já estiver rodando, reiniciamos para garantir que está ouvindo
        recognition.stop();
        setTimeout(() => recognition.start(), 100);
    }
}

async function chamarBrainServer(pergunta) {
    const URL = `${CORE_TELEMETRY_URL}/api/brain`;
    
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-alma-key': 'alma_secret_2026'
            },
            body: JSON.stringify({
                prompt: pergunta
            })
        });
        const json = await response.json();
        if (json.success && json.response) {
            return json.response;
        }
        const err = "Erro neural interno ao processar idioma no servidor.";
        speak(err);
        return err;
    } catch (e) {
        console.error(e);
        const err = "Senhor, houve uma interferência no uplink com o servidor central.";
        speak(err);
        return err;
    }
}

function speak(text, shouldRestart = true) {
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.0;
    u.pitch = 0.8;
    
    // Auto-restart da escuta após terminar de falar (apenas para respostas da IA)
    if (shouldRestart) {
        u.onend = () => {
            setTimeout(triggerVoice, 300);
        };
    }
    
    window.speechSynthesis.speak(u);
}

function initCharts() {
    Chart.defaults.color = 'rgba(255,255,255,0.4)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Reusable line chart configuration
    const createLineChart = (id, color, dataArr, multiColors = null) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        
        let gradient;
        if(multiColors) {
            gradient = ctx.getContext('2d').createLinearGradient(0, 0, 300, 0);
            gradient.addColorStop(0, multiColors[0]);
            gradient.addColorStop(0.5, multiColors[1]);
            gradient.addColorStop(1, multiColors[2]);
        }
        
        const lineCol = multiColors ? gradient : color;
        const bgGrad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 60);
        bgGrad.addColorStop(0, typeof lineCol === 'string' ? lineCol.replace('rgb', 'rgba').replace(')', ', 0.3)') : 'rgba(0,255,157,0.3)');
        bgGrad.addColorStop(1, 'transparent');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1','2','3','4','5','6','7','8'],
                datasets: [{
                    data: dataArr,
                    borderColor: lineCol,
                    backgroundColor: bgGrad,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    };

    // 1. TikTok Chart (Gradient Line)
    createLineChart('tiktokChart', null, [20,40,30,60,40,70,50,80], ['#ff3b55', '#9d00ff', '#00e5ff']);
    
    // 2. Instagram Chart (Orange/Purple gradient)
    createLineChart('instaChart', null, [60,50,70,40,80,50,90,70], ['#ff3b55', '#ff9500', '#9d00ff']);

    // 3. WhatsApp Chart (Green)
    createLineChart('wppChart', '#00ff9d', [30,20,50,40,60,30,80,60]);

    // 4. Revenue Mini Chart (Cyan)
    createLineChart('revChart', '#00e5ff', [10, 20, 15, 30, 25, 40, 35, 50]);

    // 5. Spark Chart
    createLineChart('sparkChart', '#00e5ff', [5,7,4,8,6,9,7,10]);

    // 6. Q3 Performance Bar Chart
    const barCtx = document.getElementById('barChart');
    if(barCtx) {
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Jul', 'Aug', 'Sep', 'Oct'],
                datasets: [
                    { data: [2.1, 3.1, 1.8, 2.5], backgroundColor: 'rgba(0, 255, 157, 0.8)', borderRadius: 4 },
                    { data: [1.1, 2.1, 1.2, 1.8], backgroundColor: 'rgba(0, 229, 255, 0.8)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    x: { grid: { display: false }, ticks: { font: {size: 10}} }, 
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: {display: false}, ticks: { font: {size: 10}} } 
                }
            }
        });
    }
}
