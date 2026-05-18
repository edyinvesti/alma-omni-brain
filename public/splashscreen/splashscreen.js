// ── SMART SKIP & PERSISTENCE ──
const SPLASH_COOLDOWN = 1000 * 60 * 60 * 12; // 12 horas
const lastSeen = localStorage.getItem('alma_splash_last_seen');
const nowTime = Date.now();
const isFrequentUser = lastSeen && (nowTime - lastSeen < SPLASH_COOLDOWN);
const INTRO_DURATION = isFrequentUser ? 2500 : 5500; // 2.5s se viu recentemente, senão 5.5s

// ── PARTICLES ──
let particleInterval;
const container = document.getElementById('particles');
if (container && !isFrequentUser) {
  for (let i = 0; i < 40; i++) { // Reduzido de 50 para 40 para performance
    createParticle();
  }
}

function createParticle() {
    if (!container) return;
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const dur = Math.random() * 8 + 4;
    p.style.cssText = `width:${size}px; height:${size}px; left:${x}%; top:${y}%; background:#00f0ff; box-shadow: 0 0 ${size*3}px #00f0ff; animation: particleFloat ${dur}s linear infinite;`;
    container.appendChild(p);
}

// ── AUDIO ENGINE ──
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function initAudio() {
  if (ctx) return;
  try { ctx = new AudioCtx(); } catch(e) { console.warn('[AUDIO] initAudio failed:', e.message); }
}

function playTone({ freq = 440, type = 'sine', vol = 0.15, attack = 0.01, decay = 0.1, sustain = 0.05, release = 0.3, start = 0 }) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + attack);
  gain.gain.linearRampToValueAtTime(vol * sustain, t + attack + decay);
  gain.gain.linearRampToValueAtTime(0, t + attack + decay + release);
  osc.start(t);
  osc.stop(t + attack + decay + release + 0.05);
}

function playNoise({ vol = 0.04, freq = 800, q = 1, start = 0, dur = 0.15 }) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + start;
  const bufSize = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function playFreqSweep({ freqStart = 200, freqEnd = 800, type = 'sawtooth', vol = 0.08, dur = 0.5, start = 0 }) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.linearRampToValueAtTime(0, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function playAlmaSound() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  playFreqSweep({ freqStart: 40, freqEnd: 120, type: 'sawtooth', vol: 0.06, dur: 0.8, start: 0 });
  playNoise({ vol: 0.03, freq: 200, q: 0.5, start: 0, dur: 0.8 });
  playFreqSweep({ freqStart: 800, freqEnd: 2400, type: 'square', vol: 0.04, dur: 0.6, start: 0.5 });
  playTone({ freq: 220,  type: 'sine',     vol: 0.10, attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5, start: 1.0 });
  playTone({ freq: 330,  type: 'sine',     vol: 0.07, attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5, start: 1.0 });
  playTone({ freq: 440,  type: 'triangle', vol: 0.05, attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.4, start: 1.0 });
  playNoise({ vol: 0.05, freq: 3000, q: 8, start: 1.2, dur: 0.12 });
  [1.4, 1.5, 1.6, 1.7, 1.8, 1.9].forEach((t, i) => {
    playTone({ freq: 1200 + i * 150, type: 'square', vol: 0.03, attack: 0.005, decay: 0.05, sustain: 0.01, release: 0.08, start: t });
  });
  playNoise({ vol: 0.08, freq: 1500, q: 2, start: 2.0, dur: 0.08 });
  playFreqSweep({ freqStart: 2000, freqEnd: 100, type: 'sawtooth', vol: 0.06, dur: 0.25, start: 2.0 });
  if (!isFrequentUser) {
    playTone({ freq: 880,  type: 'sine', vol: 0.06, attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.4, start: 2.3 });
  }
}

// ── TIMELINE & INTEGRATION ──
const splash = document.getElementById('splash');
let skipped = false;

function complete() {
  if (skipped) return;
  skipped = true;
  if (splash) {
    localStorage.setItem('alma_splash_last_seen', Date.now());
    splash.classList.add('fade-out');
    if (typeof speak === 'function' && !isFrequentUser) {
        speak("Conexão neural estabelecida. Bem-vindo, Comandante Edy.");
    }
    setTimeout(() => {
      splash.style.display = 'none';
      cleanupResources();
      window.dispatchEvent(new Event('splashscreen-complete'));
    }, 1000);
  }
}

function cleanupResources() {
    // RESOLVE (3) PERFORMANCE: Limpa partículas e memória
    if (container) container.innerHTML = '';
    if (particleInterval) clearInterval(particleInterval);
    console.log('[SISTEMA] Recursos da Splashscreen liberados.');
}

const autoTimer = setTimeout(complete, INTRO_DURATION);

let canSkip = false;
setTimeout(() => { 
    canSkip = true; 
    const hint = document.getElementById('skip-hint');
    if (hint) hint.style.opacity = "1";
}, 1000);

const handleSkip = () => {
  if (canSkip) {
    clearTimeout(autoTimer);
    complete();
  }
};

if (splash) splash.addEventListener('click', handleSkip);
document.addEventListener('keydown', handleSkip);

// Audio Unlock
let audioStarted = false;
const unlockAudio = () => {
  if (!audioStarted) {
    audioStarted = true;
    initAudio();
    playAlmaSound();
    // Muda o texto do hint após interação para confirmar áudio
    const hint = document.getElementById('skip-hint');
    if (hint) hint.textContent = "[ INTERFACE NEURAL SINCRONIZADA ]";
  }
};

document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

window.addEventListener('load', () => {
    try { initAudio(); playAlmaSound(); audioStarted = true; } catch(e) { console.warn('[AUDIO] load failed:', e.message); }
});
