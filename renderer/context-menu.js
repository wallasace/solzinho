function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render(state) {
  const T = I18N[state.language] || I18N.pt;
  const menu = document.getElementById('menu');
  menu.innerHTML = '';

  const toggleTips = el('div', 'item', state.tipsPaused ? T.resumeTips : T.pauseTips);
  toggleTips.addEventListener('click', () => window.menuApi.action('toggle-tips'));
  menu.appendChild(toggleTips);

  menu.appendChild(el('div', 'divider'));
  menu.appendChild(el('div', 'section-label', T.frequencySection));

  state.frequencyOptions.forEach((minutes) => {
    const checked = !state.isCustom && state.frequencyMinutes === minutes;
    const item = el('div', 'item sub-item' + (checked ? ' checked' : ''));
    item.appendChild(el('div', 'radio-dot'));
    item.appendChild(el('span', null, T.every(minutes)));
    item.addEventListener('click', () => window.menuApi.action('set-frequency', minutes));
    menu.appendChild(item);
  });

  const customItem = el('div', 'item sub-item' + (state.isCustom ? ' checked' : ''));
  customItem.appendChild(el('div', 'radio-dot'));
  customItem.appendChild(
    el('span', null, state.isCustom ? T.customLabel(state.frequencyMinutes) : T.customPlaceholder)
  );
  customItem.addEventListener('click', () => window.menuApi.action('custom-frequency'));
  menu.appendChild(customItem);

  menu.appendChild(el('div', 'divider'));

  const toggleWalk = el('div', 'item', state.walking ? T.stopWalking : T.resumeWalking);
  toggleWalk.addEventListener('click', () => window.menuApi.action('toggle-walking'));
  menu.appendChild(toggleWalk);

  const tipNow = el('div', 'item', T.tipNow);
  tipNow.addEventListener('click', () => window.menuApi.action('request-tip'));
  menu.appendChild(tipNow);

  const breathing = el('div', 'item', T.breathingExercise);
  breathing.addEventListener('click', () => window.menuApi.action('breathing-exercise'));
  menu.appendChild(breathing);

  const toggleMute = el('div', 'item', state.muted ? T.unmuteSounds : T.muteSounds);
  toggleMute.addEventListener('click', () => window.menuApi.action('toggle-mute'));
  menu.appendChild(toggleMute);

  menu.appendChild(el('div', 'divider'));
  menu.appendChild(el('div', 'section-label', T.languageSection));

  const langRow = el('div', 'lang-row');
  const ptBtn = el('span', 'lang-btn' + (state.language === 'pt' ? ' active' : ''), '🇧🇷');
  ptBtn.addEventListener('click', () => window.menuApi.action('set-language', 'pt'));
  const enBtn = el('span', 'lang-btn' + (state.language === 'en' ? ' active' : ''), '🇺🇸');
  enBtn.addEventListener('click', () => window.menuApi.action('set-language', 'en'));
  langRow.appendChild(ptBtn);
  langRow.appendChild(enBtn);
  menu.appendChild(langRow);

  menu.appendChild(el('div', 'divider'));

  const checkUpdates = el('div', 'item', T.checkForUpdates);
  checkUpdates.addEventListener('click', () => window.menuApi.action('check-for-updates'));
  menu.appendChild(checkUpdates);

  menu.appendChild(el('div', 'divider'));

  const quit = el('div', 'item danger', T.quit);
  quit.addEventListener('click', () => window.menuApi.action('quit'));
  menu.appendChild(quit);
}

window.menuApi.onState(render);
