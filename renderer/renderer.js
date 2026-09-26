const sunWrap = document.getElementById('sun-wrap');
const sunEl = document.getElementById('sun');
const bubbleEl = document.getElementById('bubble');
const bubbleTextEl = document.getElementById('bubble-text');
const breathPanelEl = document.getElementById('breath-panel');
const breathPhaseEl = document.getElementById('breath-phase');
const breathHintEl = document.getElementById('breath-hint');

let currentLanguage = 'pt';
let lastCalmMessage = null;
let lastPhysicalMessage = null;
let bubbleHideTimer = null;
let audioCtx = null;

function applyLanguage(lang) {
  currentLanguage = I18N[lang] ? lang : 'pt';
  breathHintEl.textContent = I18N[currentLanguage].breathHint;
}

function playChime() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [880, 1108.7, 1318.5]; // A5, C#6, E6 - um "tin-tin-tin" suave
    const startTime = audioCtx.currentTime;

    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const noteStart = startTime + i * 0.11;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.6);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.65);
    });
  } catch {
    // som é só um extra; se o áudio falhar, a dica continua funcionando
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
  if (kind === 'physical') {
    lastPhysicalMessage = pickMessage(pool, lastPhysicalMessage);
    bubbleTextEl.textContent = lastPhysicalMessage;
  } else {
    lastCalmMessage = pickMessage(pool, lastCalmMessage);
    bubbleTextEl.textContent = lastCalmMessage;
  }

  // reinicia as animações mesmo se o balão já estiver visível (ex.: pediu outra dica na hora)
  bubbleEl.classList.remove('visible');
  bubbleTextEl.classList.remove('text-in');
  void bubbleEl.offsetWidth;

  bubbleEl.classList.remove('hidden');
  bubbleEl.classList.add('visible');
  bubbleTextEl.classList.add('text-in');
  sunWrap.classList.add('shining');
  playChime();

  if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
  bubbleHideTimer = setTimeout(hideBubble, 12000);
}

function hideBubble() {
  bubbleEl.classList.remove('visible');
  bubbleEl.classList.add('hidden');
  sunWrap.classList.remove('shining');
  window.solzinho.bubbleDismissed();
}

bubbleEl.addEventListener('click', () => {
  if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
  hideBubble();
});

let breathPhaseTimer = null;
let breathCountdownTimer = null;
let breathingInProgress = false;

function beginBreathingCycle(cycleMs) {
  const phases = I18N[currentLanguage].phases;
  const phaseMs = cycleMs / phases.length;
  let phaseIndex = 0;

  const setPhase = () => {
    breathPhaseEl.textContent = phases[phaseIndex % phases.length];
    phaseIndex += 1;
  };

  setPhase();
  breathPhaseTimer = setInterval(setPhase, phaseMs);
  sunWrap.classList.add('breathing');
}

function startBreathing({ cycleMs, countdownMs }) {
  breathingInProgress = true;
  if (breathPhaseTimer) clearInterval(breathPhaseTimer);
  if (breathCountdownTimer) clearInterval(breathCountdownTimer);
  breathPhaseTimer = null;
  breathCountdownTimer = null;
  sunWrap.classList.remove('breathing');
  breathPanelEl.classList.remove('visible');
  void breathPanelEl.offsetWidth; // reinicia as animações do zero

  let secondsLeft = Math.round(countdownMs / 1000);
  breathPhaseEl.textContent = I18N[currentLanguage].getReady(secondsLeft);
  breathPanelEl.classList.remove('hidden');
  breathPanelEl.classList.add('visible');

  breathCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      breathPhaseEl.textContent = I18N[currentLanguage].getReady(secondsLeft);
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
  sunWrap.classList.remove('breathing');
  breathPanelEl.classList.remove('visible');
  breathPanelEl.classList.add('hidden');
}

breathPanelEl.addEventListener('click', () => {
  window.solzinho.stopBreathing();
});

breathPanelEl.addEventListener('mouseenter', () => window.solzinho.setMouseIgnore(false));
breathPanelEl.addEventListener('mouseleave', () => window.solzinho.setMouseIgnore(true));

let isDragging = false;
let dragMoved = false;
let dragStart = null;
const DRAG_THRESHOLD = 4;

sunEl.addEventListener('mouseenter', () => window.solzinho.setMouseIgnore(false));
sunEl.addEventListener('mouseleave', () => {
  if (isDragging) return; // não solta o mouse-passthrough no meio do arraste
  window.solzinho.setMouseIgnore(true);
});
bubbleEl.addEventListener('mouseenter', () => window.solzinho.setMouseIgnore(false));
bubbleEl.addEventListener('mouseleave', () => window.solzinho.setMouseIgnore(true));

sunEl.addEventListener('click', () => {
  if (dragMoved) return;
  if (breathingInProgress) {
    window.solzinho.stopBreathing();
    return;
  }
  window.solzinho.requestTip();
});

sunEl.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  isDragging = true;
  dragMoved = false;
  dragStart = { screenX: event.screenX, screenY: event.screenY };
  window.solzinho.dragStart(dragStart);
});

window.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  const dx = event.screenX - dragStart.screenX;
  const dy = event.screenY - dragStart.screenY;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
  window.solzinho.dragMove({ screenX: event.screenX, screenY: event.screenY });
});

window.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  window.solzinho.dragEnd();
  if (!sunEl.matches(':hover')) window.solzinho.setMouseIgnore(true);
});

sunEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.solzinho.openContextMenu();
});

window.solzinho.onInit((settings) => {
  applyLanguage(settings.language || 'pt');
  setState(settings.walking ? 'walk' : 'idle');
});

window.solzinho.onState(setState);
window.solzinho.onFaceDirection(setFacing);
window.solzinho.onBubble(showBubble);
window.solzinho.onBreathingStart(startBreathing);
window.solzinho.onBreathingEnd(endBreathing);
window.solzinho.onLanguageChanged(applyLanguage);
