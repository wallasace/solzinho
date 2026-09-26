const form = document.getElementById('form');
const minutesInput = document.getElementById('minutes');
const cancelBtn = document.getElementById('cancel');
const confirmBtn = document.getElementById('confirm');
const labelEl = document.getElementById('freq-label');

window.freqPrompt.onCurrent(({ minutes, language }) => {
  const T = I18N[language] || I18N.pt;
  labelEl.textContent = T.freqPromptLabel;
  cancelBtn.textContent = T.cancel;
  confirmBtn.textContent = T.confirm;
  minutesInput.value = minutes;
  minutesInput.focus();
  minutesInput.select();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = parseInt(minutesInput.value, 10);
  if (!Number.isFinite(value) || value < 1) return;
  window.freqPrompt.confirm(value);
});

cancelBtn.addEventListener('click', () => {
  window.freqPrompt.cancel();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.freqPrompt.cancel();
});
