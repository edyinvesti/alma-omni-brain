const CORE_TELEMETRY_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:3000" : "";
const API_SECRET = localStorage.getItem('alma_secret');
        if (!API_SECRET) {
            console.warn('[ALMA] API key não configurada. Gere uma chave em Settings.');
        }
let userName = localStorage.getItem('alma_user_name') || "Senhor";

window.onload = () => {
    updateTime();
    setInterval(updateTime, 1000);
    initCharts();
    initTelemetryStream();
    initVoiceCommand();
    setupInteractions();
    updateSysInfo();
    setInterval(updateSysInfo, 5000); // FIX 8: Atualiza a cada 5s
};

function updateTime() {
    const timeEl = document.getElementById('datetime');
    if (timeEl) {
        const now = new Date();
        const opts = { timeZone: 'America/Sao_Paulo' };
        const datePart = now.toLocaleDateString('pt-BR', { ...opts, day: '2-digit', month: 'short', year: 'numeric' });
        const timePart = now.toLocaleTimeString('pt-BR', { ...opts, hour12: false });
        timeEl.textContent = (datePart + " | " + timePart + " BRT").toUpperCase();
    }
}

function initTelemetryStream() {
    if (typeof io !== 'undefined') {
        // FIX 6: Socket.IO com reconexão automática
        const socket = io(CORE_TELEMETRY_URL, {
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: Infinity
        });
        
        socket.on("connect", () => {
            const statusEl = document.getElementById('connection-status');
            if (statusEl) { statusEl.textContent = 'UPCODE: CONNECTED'; statusEl.style.color = ''; }
            // FIX 5: Carrega histórico ao reconectar para manter contexto
            loadHistoryFromServer();
        });

        socket.on("disconnect", () => {
            const statusEl = document.getElementById('connection-status');
            if (statusEl) { statusEl.textContent = 'UPCODE: RECONNECTING...'; statusEl.style.color = '#ff3b55'; }
        });

        socket.on("new_log", (data) => {
            addLog(data.message, data.source, data.timestamp);
        });

        // ✅ NOV0: Feed do Obsidian em tempo real
        socket.on("obsidian_sync", (data) => {
            updateObsidianFeed(data.title);
        });

        // Alerta visual quando todos os créditos de IA esgotam
        socket.on("ai_offline", (data) => {
            const banner = document.getElementById('ai-offline-banner');
            if (banner) {
                banner.textContent = data.message;
                banner.style.display = 'block';
            } else {
                // Cria o banner se não existir
                const b = document.createElement('div');
                b.id = 'ai-offline-banner';
                b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ff3b55;color:#fff;font-weight:bold;text-align:center;padding:12px;font-size:14px;letter-spacing:1px;';
                b.textContent = '🚨 CRÉDITOS DE IA ESGOTADOS — Sistema de IA temporariamente offline. Reset automático ao amanhecer.';
                document.body.prepend(b);
            }
            speak('Atenção Comandante. Créditos de IA esgotados. Sistema offline temporariamente.');
        });
    }
}

// FIX 5: Carrega os últimos logs do servidor após reconexão
async function loadHistoryFromServer() {
    try {
        const res = await fetch(`${CORE_TELEMETRY_URL}/api/logs-recent`, {
            headers: { 'x-alma-key': API_SECRET }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.logs) {
            data.logs.reverse().forEach(l => addLog(l.message, l.source, l.timestamp));
        }
    } catch(e) { /* sem logs prévios */ }
}

// FIX 8: Atualiza dados reais do sistema a cada 5 segundos
async function updateSysInfo() {
    try {
        const res = await fetch(`${CORE_TELEMETRY_URL}/api/sysinfo`);
        if (!res.ok) return;
        const d = await res.json();
        const memEl = document.getElementById('stat-mem');
        const cpuEl = document.getElementById('stat-cpu');
        const uptEl = document.getElementById('stat-uptime');
        const loadEl = document.getElementById('system-load-val');
        const loadBarEl = document.getElementById('system-load-bar');
        if (memEl) memEl.textContent = `MEM: ${d.mem_used_gb}/${d.mem_total_gb}GB`;
        if (cpuEl) cpuEl.textContent = `CPU: ${d.cpu_cores}C`;
        if (uptEl) uptEl.textContent = `UP: ${d.uptime}`;
        if (loadEl) loadEl.textContent = `${d.mem_percent}%`;
        if (loadBarEl) loadBarEl.style.width = `${d.mem_percent}%`;
        
        // Atualiza gráfico de carga se existir
        if (window.loadChartInstance) {
            window.loadChartInstance.data.datasets[0].data.push(d.mem_percent);
            if (window.loadChartInstance.data.datasets[0].data.length > 20) window.loadChartInstance.data.datasets[0].data.shift();
            window.loadChartInstance.update();
        }

        // ✅ NOV0: Atualiza IAmobil Stats
        updateIAmobilStats();

    } catch(e) { /* servidor offline */ }
}

async function updateIAmobilStats() {
    try {
        const res = await fetch(`${CORE_TELEMETRY_URL}/api/iamobil/stats`);
        if (!res.ok) return;
        const d = await res.json();
        const propEl = document.getElementById('iamobil-properties');
        const leadEl = document.getElementById('iamobil-leads');
        if (propEl) propEl.textContent = d.properties;
        if (leadEl) leadEl.textContent = d.leads;
    } catch(e) {}
}

function updateObsidianFeed(title) {
    const feed = document.getElementById('obsidian-feed');
    if (!feed) return;
    const entry = document.createElement('div');
    entry.className = 'feed-entry';
    entry.style.borderLeft = '2px solid var(--accent-cyan)';
    entry.style.paddingLeft = '8px';
    entry.style.marginBottom = '4px';
    entry.textContent = `> SYNC: ${title}`;
    feed.insertBefore(entry, feed.firstChild);
    if (feed.childNodes.length > 10) feed.removeChild(feed.lastChild);
}

function addLog(msg, source = "SYSTEM", timestamp = null) {
    const log = document.getElementById('log-scroll');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'log-entry';
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR');
    
    const esc = (t) => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    d.textContent = `[${timeStr}][${esc(source)}] ${esc(msg)}`;
    log.insertBefore(d, log.firstChild);
}

function toggleTerminal() {
    const t = document.getElementById('terminal-overlay');
    const input = document.getElementById('cmd-input');
    
    if(!t) return;

    if(t.classList.contains('hidden')) {
        t.classList.remove('hidden');
        input.focus();
        // Não disparamos voz automaticamente no clique para evitar travas em alguns mobiles
        // O usuário pode clicar no ícone de mic se desejar.
    } else {
        if (!input.value.trim()) {
            t.classList.add('hidden');
            const logHistory = document.getElementById('log-history');
            if (logHistory) logHistory.classList.add('hidden');
        }
    }
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
    const actionMatch = resposta.match(/\[\[ACTION:\s*(.*?)\]\]/);
    if (actionMatch) {
        try {
            const actionData = JSON.parse(actionMatch[1]);
            executeSAMAction(actionData);
        } catch(e) {
            console.error("Erro ao processar ação SAM:", e);
        }
    }

    const cleanResposta = resposta.replace(/\[\[ACTION:[\s\S]*?\]\]/g, "").trim();
    addLog(cleanResposta, "A.L.M.A.");
    speak(cleanResposta);
}

async function executeSAMAction(data) {
    try {
        const res = await fetch(`${CORE_TELEMETRY_URL}/api/action`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-alma-key': API_SECRET
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
    const widgets = document.querySelectorAll('.hud-widget, .glass-card');
    widgets.forEach(widget => {
        if(widget.tagName === 'BUTTON') return;
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

// ✅ NOV0: Ações rápidas do Dashboard
async function quickAction(type) {
    let actionData = {};
    switch(type) {
        case 'obsidian': actionData = { type: 'open_app', target: 'obsidian' }; break;
        case 'clean': actionData = { type: 'clean_system' }; break;
        case 'work': actionData = { type: 'work_mode' }; break;
        case 'screenshot': actionData = { type: 'screenshot' }; break;
    }
    
    addLog(`Diretriz rápida: ${type.toUpperCase()}`, "COMANDANTE");
    await executeSAMAction(actionData);
}

// Reconhecimento de Voz (Microfone)
let recognition;
function initVoiceCommand() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
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
            micActive = false;
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
    
    if (recognition.state === 'listening') {
        return;
    }
    
    try {
        recognition.start();
        micActive = true;
    } catch(e) {
        recognition.stop();
        setTimeout(() => {
            if (recognition.state !== 'listening') {
                try {
                    recognition.start();
                    micActive = true;
                } catch(e2) { console.warn('[ALMA] Mic reinit failed:', e2.message); }
            }
        }, 100);
    }
}

async function chamarBrainServer(pergunta) {
    const URL = `${CORE_TELEMETRY_URL}/api/brain`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-alma-key': API_SECRET
            },
            body: JSON.stringify({
                prompt: pergunta
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const err = `Erro de comunicação: ${response.status}`;
            speak(err);
            return err;
        }
        
        const text = await response.text();
        if (!text || text.trim() === '') {
            const err = "Servidor devolveu resposta vazia. Tente novamente.";
            speak(err);
            return err;
        }
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            const err = "Resposta inválida do servidor.";
            speak(err);
            return err;
        }
        if (json.success && json.response) {
            return json.response;
        }
        const err = json.error || "Erro neural interno ao processar idioma no servidor.";
        speak(err);
        return err;
    } catch (e) {
        clearTimeout(timeoutId);
        console.error(e);
        const err = e.name === 'AbortError' 
            ? "Tempo limite excedido. O servidor está demorando demais para responder."
            : "Senhor, houve uma interferência no uplink com o servidor central.";
        speak(err);
        return err;
    }
}

function parseColorToRgba(color, alpha = 0.3) {
    if (typeof color !== 'string') return 'rgba(0,255,157,0.3)';
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1,3), 16);
        const g = parseInt(color.slice(3,5), 16);
        const b = parseInt(color.slice(5,7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    if (color.startsWith('rgb')) {
        return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return `rgba(0,255,157,${alpha})`;
}

function speak(text, shouldRestart = true) {
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.0;
    u.pitch = 0.8;
    
    // Auto-restart da escuta após terminar de falar (apenas para respostas da IA)
    // Só reinicia se o microfone NÃO estiver ativo e não houver reconhecimento em andamento
    if (shouldRestart && !micActive && (!recognition || recognition.state !== 'listening')) {
        u.onend = () => {
            setTimeout(() => {
                if (!micActive && (!recognition || recognition.state !== 'listening')) {
                    triggerVoice();
                }
            }, 300);
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
        bgGrad.addColorStop(0, parseColorToRgba(lineCol, 0.3));
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

    // 6. Neural Load Real-time Chart
    const loadCtx = document.getElementById('loadChart');
    if(loadCtx) {
        window.loadChartInstance = new Chart(loadCtx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: Array(20).fill(0),
                    borderColor: '#00e5ff',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
            }
        });
    }

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
