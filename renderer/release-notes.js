const titleEl = document.getElementById('title');
const notesEl = document.getElementById('notes');
const okBtn = document.getElementById('ok');

function renderNotes({ fromVersion, toVersion, language }) {
  const T = I18N[language] || I18N.pt;
  titleEl.textContent = T.whatsNewTitle(toVersion);
  okBtn.textContent = T.updateOk;

  const versions = Object.keys(RELEASE_NOTES)
    .filter((v) => compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0)
    .sort(compareVersions);

  notesEl.innerHTML = '';
  versions.forEach((v) => {
    const lines = RELEASE_NOTES[v] && RELEASE_NOTES[v][language];
    if (!lines) return;
    lines.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      notesEl.appendChild(li);
    });
  });
}

window.releaseNotesApi.onStatus(renderNotes);
okBtn.addEventListener('click', () => window.releaseNotesApi.close());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.releaseNotesApi.close();
});
