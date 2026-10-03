const sunWrap = document.getElementById('sun-wrap');
const sunEl = document.getElementById('sun');
const faceEl = document.getElementById('face');
const SUN_FACE_NORMAL = '🌞';
const SUN_FACE_WEEE = '😆'; // "weeeee" — sendo arrastado ou voando livre depois do arremesso
const SUN_FACE_DIZZY = '😵'; // tontura só no instante do impacto contra a "parede"

// O balão e o painel de respiração ficam numa janela própria (speech.html),
// controlada pelo main; daqui só se manda o texto.
let currentLanguage = 'pt';
let lastCalmMessage = null;
let lastPhysicalMessage = null;
let bubbleHideTimer = null;
let bubbleVisible = false;
let audioCtx = null;
let muted = false;
let tipsPaused = false;

function applyLanguage(lang) {
  currentLanguage = I18N[lang] ? lang : 'pt';
}

function applyMute(value) {
  muted = value;
}

function applyTipsPaused(value) {
  tipsPaused = value;
}

function applySunglasses(value) {
  sunWrap.classList.toggle('sunglasses-on', !!value);
}

function setCheckingUpdate(active) {
  sunWrap.classList.toggle('checking-update', !!active);
}

// Depois de muito tempo sem interação, o Chromium suspende o AudioContext
// sozinho (economia de energia); resume() é assíncrono. Sem esperar ele
// terminar antes de agendar as notas (ctx.currentTime + start), o primeiro
// som depois de ficar ocioso por um tempão tocava com atraso — o tempo
// agendado era calculado antes do contexto voltar a rodar de verdade.
async function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  return audioCtx;
}

// Todo SFX do app passa por aqui: um filtro passa-baixa suave, pra tirar
// qualquer aspereza das ondas (mesmo triangle/square têm harmônicos agudos
// que soam "sintético"/mecânico sem isso) — é o que dá aquele ar cozy comum
// a todos os sons, em vez de cada um soar diferente.
function warmDestination(ctx, cutoff = 2400) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.value = cutoff;
  filter.connect(ctx.destination);
  return filter;
}

// Uma notinha quentinha: triangle (corpo) + sine uma oitava acima bem baixinho
// (brilho suave), ambos passando pelo warmDestination. Serve de base pros
// chimes de dica/transformação e pro toque da batida na parede.
function playWarmNote(ctx, dest, freq, { start = 0, gain = 0.16, attack = 0.02, duration = 0.5 } = {}) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);

  const overtone = ctx.createOscillator();
  const overtoneGain = ctx.createGain();
  overtone.type = 'sine';
  overtone.frequency.value = freq * 2;
  overtoneGain.gain.setValueAtTime(0.0001, t0);
  overtoneGain.gain.linearRampToValueAtTime(gain * 0.3, t0 + attack);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.7);
  overtone.connect(overtoneGain).connect(dest);
  overtone.start(t0);
  overtone.stop(t0 + duration);
}

async function playChime() {
  if (muted) return;
  try {
    const ctx = await getAudioCtx();
    const dest = warmDestination(ctx, 2600);
    const notes = [880, 1108.7, 1318.5]; // A5, C#6, E6 — um "tin-tin-tin" quentinho
    notes.forEach((freq, i) => playWarmNote(ctx, dest, freq, { start: i * 0.11, gain: 0.15, duration: 0.6 }));
  } catch {
    // som é só um extra; se o áudio falhar, a dica continua funcionando
  }
}

async function playBounceThud(speed) {
  if (muted) return;
  try {
    const ctx = await getAudioCtx();
    const dest = warmDestination(ctx, 2200);
    // toque de "marimba" quentinho: uma nota agradável (sorteada entre umas
    // poucas, tipo sino de vento), com o volume (não o tom) escalando com a
    // força do impacto
    const strength = Math.min(speed / 900, 1);
    const notes = [392.0, 440.0, 493.88, 523.25]; // G4, A4, B4, C5
    const freq = notes[Math.floor(Math.random() * notes.length)];
    playWarmNote(ctx, dest, freq, {
      gain: 0.1 + strength * 0.08,
      attack: 0.008,
      duration: 0.28 + strength * 0.12,
    });
  } catch {
    // som é só um extra
  }
}

async function playMenuPop() {
  if (muted) return;
  try {
    const ctx = await getAudioCtx();
    const dest = warmDestination(ctx, 1800);
    const t0 = ctx.currentTime;
    // pop curto e discreto, mas redondo — sem harmônico, sem "corpo" grande,
    // só o filtro já tira a aspereza que a onda triangular teria sozinha
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, t0);
    osc.frequency.exponentialRampToValueAtTime(700, t0 + 0.02);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.07, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    osc.connect(gain).connect(dest);
    osc.start(t0);
    osc.stop(t0 + 0.07);
  } catch {
    // som é só um extra
  }
}

async function playMoonToSunChime() {
  if (muted) return;
  try {
    const ctx = await getAudioCtx();
    const dest = warmDestination(ctx, 2400);
    // "puf" de transformação: duas notas subindo, quentinhas, como a lua se
    // desfazendo de volta em sol
    [660, 1050].forEach((freq, i) => playWarmNote(ctx, dest, freq, { start: i * 0.09, gain: 0.15, duration: 0.4 }));
  } catch {
    // som é só um extra
  }
}

function setState(state) {
  sunWrap.classList.remove('walking', 'idle');
  sunWrap.classList.add(state === 'idle' ? 'idle' : 'walking');
}

function setFacing(direction) {
  sunWrap.classList.toggle('facing-left', direction === -1);
}

function showBubble(kind) {
  const pool = (kind === 'physical' ? PHYSICAL_MESSAGES : MESSAGES)[currentLanguage];
  let text;
  if (kind === 'physical') {
    lastPhysicalMessage = pickMessage(pool, lastPhysicalMessage);
    text = lastPhysicalMessage;
  } else {
    lastCalmMessage = pickMessage(pool, lastCalmMessage);
    text = lastCalmMessage;
  }

  bubbleVisible = true;
  window.solzinho.speechShow({ kind: kind === 'physical' ? 'physical' : 'tip', text });
  sunWrap.classList.add('shining');
  playChime();

  if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
  bubbleHideTimer = setTimeout(hideBubble, 12000);
}

function hideBubble() {
  if (!bubbleVisible) return;
  bubbleVisible = false;
  if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
  bubbleHideTimer = null;
  sunWrap.classList.remove('shining');
  if (!breathingInProgress) window.solzinho.speechHide();
  window.solzinho.bubbleDismissed();
}

let breathPhaseTimer = null;
let breathCountdownTimer = null;
let breathingInProgress = false;

function beginBreathingCycle(cycleMs) {
  const phases = I18N[currentLanguage].phases;
  const phaseMs = cycleMs / phases.length;
  let phaseIndex = 0;

  const setPhase = () => {
    window.solzinho.speechUpdate({ text: phases[phaseIndex % phases.length] });
    phaseIndex += 1;
  };

  setPhase();
  breathPhaseTimer = setInterval(setPhase, phaseMs);
  sunWrap.classList.add('breathing');
}

let moonExitTimer = null;
let breathingPromptActive = false;
let breathingPromptTimer = null;
const BREATHING_PROMPT_MS = 7000;

function startBreathing({ cycleMs, countdownMs }) {
  hideBubble(); // se tinha uma dica na tela, o exercício toma o lugar dela
  hideBreathingPrompt(); // um novo ciclo cancela o convite de repetir, se estava na tela
  breathingInProgress = true;
  if (breathPhaseTimer) clearInterval(breathPhaseTimer);
  if (breathCountdownTimer) clearInterval(breathCountdownTimer);
  breathPhaseTimer = null;
  breathCountdownTimer = null;
  sunWrap.classList.remove('breathing');

  // o sol vira lua durante a contagem regressiva
  if (moonExitTimer) clearTimeout(moonExitTimer);
  sunWrap.classList.remove('moon-exit');
  sunWrap.classList.add('moon-mode');

  const T = I18N[currentLanguage];
  let secondsLeft = Math.round(countdownMs / 1000);
  window.solzinho.speechShow({ kind: 'breath', text: T.getReady(secondsLeft), hint: T.breathHint });

  breathCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      window.solzinho.speechUpdate({ text: T.getReady(secondsLeft) });
      return;
    }
    clearInterval(breathCountdownTimer);
    breathCountdownTimer = null;
    beginBreathingCycle(cycleMs);
  }, 1000);
}

function endBreathing() {
  breathingInProgress = false;
  if (breathPhaseTimer) clearInterval(breathPhaseTimer);
  if (breathCountdownTimer) clearInterval(breathCountdownTimer);
  breathPhaseTimer = null;
  breathCountdownTimer = null;
  sunWrap.classList.remove('breathing', 'moon-mode');
  // a lua volta a ser sol (animação moon-exit no CSS)
  sunWrap.classList.add('moon-exit');
  moonExitTimer = setTimeout(() => sunWrap.classList.remove('moon-exit'), 650);
  window.solzinho.speechHide();
}

// convite pra repetir o exercício, mostrado no balão assim que o sol termina
// de voltar; some sozinho depois de um tempo se ninguém tocar nele
function hideBreathingPrompt() {
  if (!breathingPromptActive) return;
  breathingPromptActive = false;
  if (breathingPromptTimer) clearTimeout(breathingPromptTimer);
  breathingPromptTimer = null;
  window.solzinho.speechHide();
}

function dismissBreathingPrompt() {
  if (!breathingPromptActive) return;
  hideBreathingPrompt();
  window.solzinho.breathingPromptDismissed();
}

function showBreathingPrompt() {
  const T = I18N[currentLanguage];
  breathingPromptActive = true;
  window.solzinho.speechShow({ kind: 'breath-done', text: T.breathingDoneText, hint: T.breathingAgainHint });
  breathingPromptTimer = setTimeout(dismissBreathingPrompt, BREATHING_PROMPT_MS);
}

window.solzinho.onBreathingDonePrompt(showBreathingPrompt);

// clique no balão: fecha a dica, aceita o convite de repetir a respiração,
// ou encerra o exercício de respiração que está rolando
window.solzinho.onSpeechClicked(() => {
  if (breathingPromptActive) {
    hideBreathingPrompt();
    window.solzinho.breathingAgainRequest();
  } else if (breathingInProgress) {
    playMoonToSunChime();
    window.solzinho.stopBreathing();
  } else {
    hideBubble();
  }
});

let isDragging = false;
let dragMoved = false;
let dragStart = null;
let flingActive = false;
let flingSpeed = 0;
let impactActive = false;
const DRAG_THRESHOLD = 4;

// Graus de empolgação durante o arremesso: bem devagar (perto de já ter
// parado) some a animação e volta pro idle/caminhada de baixo sozinho;
// devagar é uma versão contida do "weee" (corpo, sem trocar a cara);
// rápido é o "weee" cheio (corpo + cara). Ao arrastar com a mão é sempre
// o "weee" cheio, não depende de velocidade.
const FLING_CALM_SPEED = 40; // abaixo disso, já pode ser tratado como "parado"
const FLING_WILD_SPEED = 260; // acima disso, empolgação máxima

function setFlingSpeed(speed) {
  flingSpeed = speed;
  updateMotionVisual();
}

// Estado de movimento do sol: "weee" enquanto está sendo arrastado (depois
// de já ter se movido) ou voando livre após o arremesso; "dizzy" só no
// instante de bater na "parede" (some sozinho quando o squash termina);
// fora disso, cara e corpo normais.
let wasMoving = false;

function updateMotionVisual() {
  const flingCalm = flingActive && flingSpeed <= FLING_CALM_SPEED;
  const moving = isDragging || (flingActive && !flingCalm);
  const wild = moving && (isDragging || flingSpeed >= FLING_WILD_SPEED);
  const mild = moving && !wild;
  sunWrap.classList.toggle('dizzy', impactActive);
  sunWrap.classList.toggle('weee', wild && !impactActive);
  sunWrap.classList.toggle('weee-mild', mild && !impactActive);
  faceEl.textContent = impactActive ? SUN_FACE_DIZZY : wild ? SUN_FACE_WEEE : SUN_FACE_NORMAL;

  // ao parar de se mexer (arraste solto sem virar arremesso, ou arremesso
  // decaindo até ficar "calmo"), sem isso o balanço do weee cortava seco
  // pro idle/caminhada — uma animação curta de assentar em vez de um corte
  if (wasMoving && !moving && !impactActive) {
    sunWrap.classList.remove('settling');
    void sunWrap.offsetWidth; // reinicia se ainda estiver tocando de uma parada anterior
    sunWrap.classList.add('settling');
  } else if (moving) {
    // um novo movimento começou antes do "assentar" terminar — cancela,
    // senão ele ganharia do weee/weee-mild na empate de especificidade
    sunWrap.classList.remove('settling');
  }
  wasMoving = moving;
}

function playClickBounce() {
  sunWrap.classList.remove('clicked');
  void sunWrap.offsetWidth; // reinicia a animação em cliques seguidos
  sunWrap.classList.add('clicked');
  sunWrap.dispatchEvent(new Event('mascot-poke'));
}

sunWrap.addEventListener('animationend', (event) => {
  if (event.animationName === 'click-bounce') sunWrap.classList.remove('clicked');
  if (event.animationName === 'settle-wobble' || event.animationName === 'settle-wobble-left') {
    sunWrap.classList.remove('settling');
  }
});

sunWrap.addEventListener('click', () => {
  if (dragMoved) return;
  playClickBounce();
  if (breathingInProgress) {
    playMoonToSunChime();
    window.solzinho.stopBreathing();
    return;
  }
  // com as dicas pausadas, pedir uma dica não mostra bolha nenhuma (o
  // barulhinho normal só toca junto com a bolha aparecendo) — sem isso, o
  // clique ficava mudo, sem nenhum retorno sonoro
  if (tipsPaused) playChime();
  window.solzinho.requestTip();
});

sunWrap.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  isDragging = true;
  dragMoved = false;
  dragStart = { screenX: event.screenX, screenY: event.screenY };
  window.solzinho.dragStart();
});

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  window.solzinho.dragEnd();
  updateMotionVisual();
}

window.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  // o "soltei o botão" pode se perder (ex.: ao cruzar pra um monitor com
  // outra escala); se o botão já não está pressionado, encerra o arraste
  if (event.buttons === 0) {
    endDrag();
    return;
  }
  const dx = event.screenX - dragStart.screenX;
  const dy = event.screenY - dragStart.screenY;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    if (!dragMoved) updateMotionVisual();
    dragMoved = true;
  }
});

window.addEventListener('mouseup', endDrag);

sunWrap.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  playMenuPop();
  window.solzinho.openContextMenu();
});

function playWallBounce({ axis, speed }) {
  sunWrap.classList.remove('wall-bounce-x', 'wall-bounce-y');
  void sunWrap.offsetWidth; // reinicia a animação em batidas seguidas
  sunWrap.classList.add(axis === 'y' ? 'wall-bounce-y' : 'wall-bounce-x');
  impactActive = true;
  updateMotionVisual();
  playBounceThud(speed);
}

sunWrap.addEventListener('animationend', (event) => {
  if (event.animationName === 'wall-squash-x' || event.animationName === 'wall-squash-y') {
    sunWrap.classList.remove('wall-bounce-x', 'wall-bounce-y');
    impactActive = false;
    updateMotionVisual();
  }
});

// Enquanto está sendo arrastado ou voando livre depois do arremesso: cara
// de "weeeee" e o brilho (mesmo #glow de outros estados) encolhe um pouco
// e volta, girando bem devagar. Ao bater na "parede", uma tontura rápida
// (ver playWallBounce); ao parar de vez, volta ao normal sem transição
// especial (o "pode manter como está" do pedido original).
function setFlinging(active) {
  flingActive = active;
  if (!active) flingSpeed = 0;
  updateMotionVisual();
}

window.solzinho.onInit((settings) => {
  applyLanguage(settings.language || 'pt');
  applyMute(!!settings.muted);
  applySunglasses(!!settings.sunglasses);
  applyTipsPaused(!!settings.tipsPaused);
  setState(settings.walking ? 'walk' : 'idle');
});

window.solzinho.onState(setState);
window.solzinho.onFaceDirection(setFacing);
window.solzinho.onBubble(showBubble);
window.solzinho.onBreathingStart(startBreathing);
window.solzinho.onBreathingEnd(endBreathing);
window.solzinho.onLanguageChanged(applyLanguage);
window.solzinho.onMuteChanged(applyMute);
window.solzinho.onTipsPausedChanged(applyTipsPaused);
window.solzinho.onSunglassesChanged(applySunglasses);
window.solzinho.onCheckingUpdate(setCheckingUpdate);
// alguém tentou abrir uma segunda cópia — dá um pulinho + um tin-tin pra
// sinalizar "tô aqui", em vez de não dar sinal nenhum de vida
window.solzinho.onAlreadyRunningPing(() => {
  playClickBounce();
  playChime();
});
window.solzinho.onFlinging(setFlinging);
window.solzinho.onFlingSpeed(setFlingSpeed);
window.solzinho.onBounce(playWallBounce);
