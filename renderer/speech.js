const card = document.getElementById('card');
const textEl = document.getElementById('text');
const hintEl = document.getElementById('hint');

function reportSize() {
  // offsetWidth/Height ignoram o transform da animação de entrada
  window.speech.reportSize({ width: card.offsetWidth, height: card.offsetHeight });
}

window.speech.onContent(({ kind, text, hint }) => {
  card.classList.toggle('tip', kind === 'tip' || kind === 'physical');
  card.classList.toggle('physical', kind === 'physical');
  card.classList.toggle('breath', kind === 'breath' || kind === 'breath-done');
  card.classList.toggle('cta', kind === 'breath-done');
  textEl.textContent = text;
  hintEl.textContent = hint || '';
  reportSize();
});

window.speech.onUpdate(({ text }) => {
  textEl.textContent = text;
  reportSize();
});

window.speech.onPlacement(({ side, tailX, animate }) => {
  card.classList.toggle('above', side === 'above');
  card.classList.toggle('below', side === 'below');
  card.style.setProperty('--tail-x', `${tailX}px`);
  if (animate) {
    card.classList.remove('visible');
    textEl.classList.remove('text-in');
    void card.offsetWidth; // reinicia a animação de entrada
    card.classList.add('visible');
    textEl.classList.add('text-in');
  }
});

card.addEventListener('click', () => window.speech.click());
