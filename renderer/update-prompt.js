const titleEl = document.getElementById('title');
const bodyEl = document.getElementById('body');
const primaryBtn = document.getElementById('primary');
const secondaryBtn = document.getElementById('secondary');

function showSingleButton(T, title, body) {
  titleEl.textContent = title;
  bodyEl.textContent = body;
  primaryBtn.textContent = T.updateOk;
  secondaryBtn.style.display = 'none';
  primaryBtn.onclick = () => window.updatePrompt.later();
}

window.updatePrompt.onStatus(({ status, version, language }) => {
  const T = I18N[language] || I18N.pt;
  secondaryBtn.style.display = '';

  if (status === 'ready') {
    titleEl.textContent = T.updateReadyTitle;
    bodyEl.textContent = T.updateReadyBody(version);
    primaryBtn.textContent = T.updateNow;
    secondaryBtn.textContent = T.updateLater;
    primaryBtn.onclick = () => window.updatePrompt.updateNow();
    secondaryBtn.onclick = () => window.updatePrompt.later();
  } else if (status === 'up-to-date') {
    showSingleButton(T, T.updateUpToDateTitle, T.updateUpToDateBody);
  } else if (status === 'dev-mode') {
    showSingleButton(T, T.updateDevModeTitle, T.updateDevModeBody);
  } else {
    showSingleButton(T, T.updateErrorTitle, T.updateErrorBody);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.updatePrompt.later();
});
