const sunWrap = document.getElementById('sun-wrap');

// O balão e o painel de respiração ficam numa janela própria (speech.html),
// controlada pelo main; daqui só se manda o texto.
let currentLanguage = 'pt';
let lastCalmMessage = null;
let lastPhysicalMessage = null;
let bubbleHideTimer = null;
let bubbleVisible = false;
let audioCtx = null;
let muted = false;

function applyLanguage(lang) {
  currentLanguage = I18N[lang] ? lang : 'pt';
}

function applyMute(value) {
  muted = value;
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime() {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const notes = [880, 1108.7, 1318.5]; // A5, C#6, E6 - um "tin-tin-tin" suave
    const startTime = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const noteStart = startTime + i * 0.11;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.6);

      osc.connect(gain).connect(ctx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.65);
    });
  } catch {
    // som é só um extra; se o áudio falhar, a dica continua funcionando
  }
}

function playBounceThud(speed) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const t0 = ctx.currentTime;
    // "boing" curto: um tom grave que sobe rapidinho e um clique seco de impacto,
    // com o volume proporcional à força da batida
    const strength = Math.min(speed / 900, 1);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.08 + strength * 0.18, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.value = 900;
    clickGain.gain.setValueAtTime(0.05 + strength * 0.06, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    click.connect(clickGain).connect(ctx.destination);
    click.start(t0);
    click.stop(t0 + 0.04);
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
  window.solzinho.speechShow({ kind: 'tip', text });
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

function startBreathing({ cycleMs, countdownMs }) {
  hideBubble(); // se tinha uma dica na tela, o exercício toma o lugar dela
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
  moonExitTimer = setTimeout(() => sunWrap.classList.remove('moon-exit'), 1700);
  window.solzinho.speechHide();
}

// clique no balão: fecha a dica, ou encerra o exercício de respiração
window.solzinho.onSpeechClicked(() => {
  if (breathingInProgress) window.solzinho.stopBreathing();
  else hideBubble();
});

let isDragging = false;
let dragMoved = false;
let dragStart = null;
const DRAG_THRESHOLD = 4;

function playClickBounce() {
  sunWrap.classList.remove('clicked');
  void sunWrap.offsetWidth; // reinicia a animação em cliques seguidos
  sunWrap.classList.add('clicked');
}

sunWrap.addEventListener('animationend', (event) => {
  if (event.animationName === 'click-bounce') sunWrap.classList.remove('clicked');
});

sunWrap.addEventListener('click', () => {
  if (dragMoved) return;
  playClickBounce();
  if (breathingInProgress) {
    window.solzinho.stopBreathing();
    return;
  }
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
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
});

window.addEventListener('mouseup', endDrag);

sunWrap.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.solzinho.openContextMenu();
});

function playWallBounce({ axis, speed }) {
  sunWrap.classList.remove('wall-bounce-x', 'wall-bounce-y');
  void sunWrap.offsetWidth; // reinicia a animação em batidas seguidas
  sunWrap.classList.add(axis === 'y' ? 'wall-bounce-y' : 'wall-bounce-x');
  playBounceThud(speed);
}

sunWrap.addEventListener('animationend', (event) => {
  if (event.animationName === 'wall-squash-x' || event.animationName === 'wall-squash-y') {
    sunWrap.classList.remove('wall-bounce-x', 'wall-bounce-y');
  }
});

window.solzinho.onInit((settings) => {
  applyLanguage(settings.language || 'pt');
  applyMute(!!settings.muted);
  setState(settings.walking ? 'walk' : 'idle');
});

window.solzinho.onState(setState);
window.solzinho.onFaceDirection(setFacing);
window.solzinho.onBubble(showBubble);
window.solzinho.onBreathingStart(startBreathing);
window.solzinho.onBreathingEnd(endBreathing);
window.solzinho.onLanguageChanged(applyLanguage);
window.solzinho.onMuteChanged(applyMute);
window.solzinho.onBounce(playWallBounce);
