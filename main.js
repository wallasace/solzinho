const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const WIN_W = 260;
const WIN_H = 320;
const EDGE_MARGIN = 10;
const TICK_MS = 30;
const BASE_SPEED = 1.1; // px per tick

const FREQUENCY_OPTIONS = [15, 30, 60, 120];

let win;
let direction = 1; // 1 = right, -1 = left
// motivos independentes que podem pausar a caminhada; a caminhada só volta
// quando TODOS forem removidos (evita que o ciclo de idle "destrave" a
// caminhada enquanto um popup ainda está aberto, por exemplo)
const pauseReasons = new Set();
function pauseWalk(reason) {
  pauseReasons.add(reason);
}
function resumeWalk(reason) {
  pauseReasons.delete(reason);
}
function isWalkPaused() {
  return pauseReasons.size > 0;
}
let dragging = false; // true while the user is dragging the sun
let dragStartMouse = null;
let dragStartBounds = null;
let dragTimer = null;
let tickTimer = null;
let idleTimeout = null;
let idleResumeTimeout = null;
let tipTimeout = null;
let physicalTipTimeout = null;
let pendingTip = null; // 'calm' | 'physical' | null — dica adiada por causa de um popup aberto

const PHYSICAL_TIP_MINUTES = 20; // pausas físicas (água, esticar, levantar) num ritmo próprio
let freqPromptWin = null;
let menuWin = null;
let updatePromptWin = null;
let manualUpdateCheck = false; // true só quando a checagem veio do menu ("Buscar atualização")
let breathingActive = false;
let breathingTimeout = null;

const BREATHING_CYCLE_MS = 16000; // inspira 4s + segura 4s + solta 4s + segura 4s
const BREATHING_CYCLES = 4;
const BREATHING_COUNTDOWN_MS = 3000;
const BREATHING_EXIT_ANIM_MS = 700; // duração da transformação lua->sol (renderer/style.css)

const MENU_W = 260;
const MENU_H = 590;
const FREQ_PROMPT_W = 280;
const FREQ_PROMPT_H = 150;
const UPDATE_PROMPT_W = 300;
const UPDATE_PROMPT_H = 180;
// distância do topo da janela invisível do sol (WIN_H) até o topo visual do
// sol de verdade: bottom:10px + 96px de altura do #sun-wrap (renderer/style.css)
const SUN_SIZE = 96;
const SUN_BOTTOM_MARGIN = 10;
const SUN_VISUAL_TOP_MARGIN = SUN_BOTTOM_MARGIN + SUN_SIZE;
const SUN_SIDE_OFFSET = (WIN_W - SUN_SIZE) / 2;

function getSunAnchorTop(sunBounds) {
  return sunBounds.y + WIN_H - SUN_VISUAL_TOP_MARGIN;
}

// A janela é maior que o sol visível (sobra espaço dos lados e em cima pro
// balão), então o limite de tela é aplicado ao sol, não à janela — a parte
// invisível da janela pode sair da tela.
function clampSunWindowPosition(x, y, area) {
  const minX = area.x - SUN_SIDE_OFFSET;
  const maxX = area.x + area.width - WIN_W + SUN_SIDE_OFFSET;
  const minY = area.y - (WIN_H - SUN_VISUAL_TOP_MARGIN);
  const maxY = area.y + area.height - WIN_H + SUN_BOTTOM_MARGIN;
  return {
    x: Math.round(Math.min(Math.max(x, minX), maxX)),
    y: Math.round(Math.min(Math.max(y, minY), maxY)),
  };
}

function computeFreqPromptPosition(sunBounds, area) {
  let x = Math.round(sunBounds.x + sunBounds.width / 2 - FREQ_PROMPT_W / 2);
  let y = Math.round(getSunAnchorTop(sunBounds) - FREQ_PROMPT_H - 12);
  x = Math.min(Math.max(x, area.x), area.x + area.width - FREQ_PROMPT_W);
  y = Math.max(y, area.y);
  return { x, y };
}

function computeUpdatePromptPosition(sunBounds, area) {
  let x = Math.round(sunBounds.x + sunBounds.width / 2 - UPDATE_PROMPT_W / 2);
  let y = Math.round(getSunAnchorTop(sunBounds) - UPDATE_PROMPT_H - 12);
  x = Math.min(Math.max(x, area.x), area.x + area.width - UPDATE_PROMPT_W);
  y = Math.max(y, area.y);
  return { x, y };
}

function computeMenuPosition(sunBounds, area) {
  const sunRightEdge = sunBounds.x + sunBounds.width / 2 + 48;
  const sunCenterY = getSunAnchorTop(sunBounds) + 48;
  let x = Math.round(sunRightEdge + 12);
  let y = Math.round(sunCenterY - MENU_H / 2);
  x = Math.min(x, area.x + area.width - MENU_W);
  x = Math.max(x, area.x);
  y = Math.min(Math.max(y, area.y), area.y + area.height - MENU_H);
  return { x, y };
}

function repositionFollowerWindows() {
  if (!win || win.isDestroyed()) return;
  const area = currentWorkArea();
  const sunBounds = win.getBounds();

  if (freqPromptWin && !freqPromptWin.isDestroyed()) {
    const { x, y } = computeFreqPromptPosition(sunBounds, area);
    freqPromptWin.setBounds({ x, y, width: FREQ_PROMPT_W, height: FREQ_PROMPT_H });
  }

  if (menuWin && !menuWin.isDestroyed()) {
    const { x, y } = computeMenuPosition(sunBounds, area);
    menuWin.setBounds({ x, y, width: MENU_W, height: MENU_H });
  }

  if (updatePromptWin && !updatePromptWin.isDestroyed()) {
    const { x, y } = computeUpdatePromptPosition(sunBounds, area);
    updatePromptWin.setBounds({ x, y, width: UPDATE_PROMPT_W, height: UPDATE_PROMPT_H });
  }

  placeSpeech();

  // O menu (diferente do balão, que nasce com `focusable: false`) rouba o
  // topo da pilha de janelas "screen-saver" assim que abre; sem isso, o sol
  // ficava por baixo dele sempre que se movia até ali (arraste ou quique de
  // arremesso enquanto o menu está aberto). `moveTop()` só reordena a
  // pilha, não tira o foco do menu — continua clicável normalmente.
  if ((menuWin && !menuWin.isDestroyed()) || (freqPromptWin && !freqPromptWin.isDestroyed())) {
    win.moveTop();
  }
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch {
    // não é crítico se não conseguir salvar
  }
}

const settings = Object.assign(
  { frequencyMinutes: 30, tipsPaused: false, walking: true, language: 'en', muted: false, autoLaunch: true, sunglasses: false },
  loadSettings()
);

// Centro do sol visível na tela, a partir da posição da janela.
function sunCenter(pos) {
  return {
    x: Math.round(pos.x + WIN_W / 2),
    y: Math.round(pos.y + WIN_H - SUN_BOTTOM_MARGIN - SUN_SIZE / 2),
  };
}

// Área útil do monitor onde o sol visível está. Usa o centro do sol, não a
// janela: a janela é bem maior e pode estar mais em cima de outro monitor.
function currentWorkArea() {
  if (win && !win.isDestroyed()) return screen.getDisplayNearestPoint(sunCenter(getSunPos())).workArea;
  return screen.getPrimaryDisplay().workArea;
}

function createWindow() {
  const area = currentWorkArea();
  const x = area.x + Math.floor((area.width - WIN_W) / 2);
  const y = area.y + area.height - WIN_H + SUN_BOTTOM_MARGIN;
  sunPos = { x, y };

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('init-settings', settings);
  });

  startWalking();
  hoverTimer = setInterval(hoverTick, 50);
  scheduleNextIdle();
  scheduleNextTip();
  scheduleNextPhysicalTip();
}

// Posição da janela do sol guardada aqui (com casas decimais) em vez de relida
// com getBounds() a cada passo: em monitor com escala != 100% o Windows
// arredonda a posição e um passo de ~1px some, deixando o sol parado.
let sunPos = null;

function getSunPos() {
  if (!sunPos) {
    const b = win.getBounds();
    sunPos = { x: b.x, y: b.y };
  }
  return sunPos;
}

function setSunBounds(x, y) {
  sunPos = { x, y };
  const rect = { x: Math.round(x), y: Math.round(y), width: WIN_W, height: WIN_H };
  win.setBounds(rect);
  // ao cruzar para um monitor com outra escala o Windows pode redimensionar a janela
  const [w, h] = win.getSize();
  if (w !== WIN_W || h !== WIN_H) win.setSize(WIN_W, WIN_H);

  const displayId = screen.getDisplayMatching(rect).id;
  if (sunDisplayId !== null && displayId !== sunDisplayId) displayChangePending = true;
  sunDisplayId = displayId;
  if (displayChangePending && !dragging) refreshInputAfterDisplayChange();
}

// Bug do Electron/Windows: janela levada para um monitor com outra escala
// (ex.: 100% -> 150%) passa a perder o "apertei o botão" do mouse — o
// "soltei" chega, mas o arraste nunca começa. Janela criada direto no outro
// monitor não tem o problema. Um redimensionamento de verdade (1px e volta)
// faz o Chromium se reajustar; esconder e mostrar também resolve, mas pisca.
let sunDisplayId = null;
let displayChangePending = false;

function refreshInputAfterDisplayChange() {
  displayChangePending = false;
  const x = Math.round(sunPos.x);
  const y = Math.round(sunPos.y);
  win.setBounds({ x, y, width: WIN_W + 1, height: WIN_H + 1 });
  setTimeout(() => {
    if (win && !win.isDestroyed()) setSunBounds(sunPos.x, sunPos.y);
  }, 50);
}

function startWalking() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!settings.walking || isWalkPaused() || dragging || !win || win.isDestroyed()) return;
    // Andando sozinho ele fica no monitor onde está; só troca de tela arrastado.
    const pos = getSunPos();
    const area = currentWorkArea();
    let nextX = pos.x + direction * BASE_SPEED;

    const minX = area.x - SUN_SIDE_OFFSET + EDGE_MARGIN;
    const maxX = area.x + area.width - WIN_W + SUN_SIDE_OFFSET - EDGE_MARGIN;

    if (nextX <= minX) {
      nextX = minX;
      direction = 1;
    } else if (nextX >= maxX) {
      nextX = maxX;
      direction = -1;
    }

    setSunBounds(nextX, pos.y);
    win.webContents.send('face-direction', direction);
  }, TICK_MS);
}

function scheduleNextIdle() {
  if (idleTimeout) clearTimeout(idleTimeout);
  const nextInMs = (15 + Math.random() * 40) * 1000;
  idleTimeout = setTimeout(() => {
    if (settings.walking && win && !win.isDestroyed()) {
      pauseWalk('idle');
      win.webContents.send('state', 'idle');
      const idleDuration = 3000 + Math.random() * 5000;
      idleResumeTimeout = setTimeout(() => {
        resumeWalk('idle');
        if (win && !win.isDestroyed()) win.webContents.send('state', 'walk');
        scheduleNextIdle();
      }, idleDuration);
    } else {
      scheduleNextIdle();
    }
  }, nextInMs);
}

function scheduleNextTip() {
  if (tipTimeout) clearTimeout(tipTimeout);
  const baseMs = settings.frequencyMinutes * 60 * 1000;
  const jitter = 0.8 + Math.random() * 0.4;
  tipTimeout = setTimeout(() => {
    triggerBubble('calm');
    scheduleNextTip();
  }, baseMs * jitter);
}

function scheduleNextPhysicalTip() {
  if (physicalTipTimeout) clearTimeout(physicalTipTimeout);
  const baseMs = PHYSICAL_TIP_MINUTES * 60 * 1000;
  const jitter = 0.8 + Math.random() * 0.4;
  physicalTipTimeout = setTimeout(() => {
    triggerBubble('physical');
    scheduleNextPhysicalTip();
  }, baseMs * jitter);
}

function isPopupOpen() {
  return (freqPromptWin && !freqPromptWin.isDestroyed()) || (menuWin && !menuWin.isDestroyed());
}

function isBusy() {
  return isPopupOpen() || breathingActive;
}

function triggerBubble(kind = 'calm') {
  if (settings.tipsPaused || !win || win.isDestroyed()) return;
  if (isBusy()) {
    pendingTip = kind; // só guarda a última dica pendente, nunca acumula mais de uma
    return;
  }
  pauseWalk('bubble');
  win.webContents.send('show-bubble', kind);
}

// ---- Janela do balão (dica / painel de respiração) ----
// O balão tem janela própria, criada ao aparecer e destruída ao sumir, e se
// posiciona em volta do sol: acima dele, ou abaixo se não houver espaço em
// cima, e deslocado pro lado quando o sol está na borda. Assim o sol nunca
// precisa sair do lugar pra falar. Criar a janela a cada vez, já no monitor
// do sol, também evita o bug do Electron de perder o clique ao trocar de
// monitor com outra escala.
const SPEECH_MARGIN = 14; // margem transparente em volta do cartão (sombra/pontinha)
const SPEECH_GAP = 10; // distância entre o cartão e o sol
let speechWin = null;
let speechCardSize = null;
let speechAnimatePending = false;

function sunVisualRect() {
  const pos = getSunPos();
  return {
    x: pos.x + SUN_SIDE_OFFSET,
    y: pos.y + WIN_H - SUN_VISUAL_TOP_MARGIN,
    width: SUN_SIZE,
    height: SUN_SIZE,
  };
}

function computeSpeechPlacement() {
  const sun = sunVisualRect();
  const area = currentWorkArea();
  const W = speechCardSize.width + 2 * SPEECH_MARGIN;
  const H = speechCardSize.height + 2 * SPEECH_MARGIN;
  const sunCenterX = sun.x + sun.width / 2;

  let x = Math.round(sunCenterX - W / 2);
  x = Math.min(Math.max(x, area.x), area.x + area.width - W);

  let side = 'above';
  let y = Math.round(sun.y - SPEECH_GAP - speechCardSize.height - SPEECH_MARGIN);
  if (y < area.y) {
    side = 'below';
    y = Math.round(sun.y + sun.height + SPEECH_GAP - SPEECH_MARGIN);
    y = Math.min(y, area.y + area.height - H);
  }

  // a pontinha aponta pro sol mesmo com o cartão deslocado pro lado
  const tailX = Math.min(Math.max(sunCenterX - (x + SPEECH_MARGIN), 22), speechCardSize.width - 22);
  return { bounds: { x, y, width: W, height: H }, side, tailX };
}

function placeSpeech() {
  if (!speechWin || speechWin.isDestroyed() || !speechCardSize) return;
  const p = computeSpeechPlacement();
  speechWin.setBounds(p.bounds);
  speechWin.webContents.send('speech-placement', { side: p.side, tailX: p.tailX, animate: speechAnimatePending });
  speechAnimatePending = false;
  if (!speechWin.isVisible()) speechWin.showInactive();
}

function showSpeech(content) {
  speechAnimatePending = true;
  if (speechWin && !speechWin.isDestroyed()) {
    speechWin.webContents.send('speech-content', content);
    return;
  }
  speechCardSize = null;
  const sun = sunVisualRect();
  const s = new BrowserWindow({
    x: Math.round(sun.x),
    y: Math.round(sun.y),
    width: 200,
    height: 100,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'speech-preload.js'),
      contextIsolation: true,
    },
  });
  speechWin = s;
  s.setAlwaysOnTop(true, 'screen-saver');
  s.loadFile(path.join(__dirname, 'renderer', 'speech.html'));
  s.webContents.once('did-finish-load', () => {
    if (!s.isDestroyed()) s.webContents.send('speech-content', content);
  });
  s.on('closed', () => {
    if (speechWin === s) {
      speechWin = null;
      speechCardSize = null;
    }
  });
}

function hideSpeech() {
  if (!speechWin || speechWin.isDestroyed()) return;
  const s = speechWin;
  speechWin = null;
  speechCardSize = null;
  s.destroy();
}

ipcMain.on('speech-show', (_event, content) => showSpeech(content));
ipcMain.on('speech-update', (_event, content) => {
  if (speechWin && !speechWin.isDestroyed()) speechWin.webContents.send('speech-update', content);
});
ipcMain.on('speech-hide', hideSpeech);
ipcMain.on('speech-size', (event, size) => {
  if (!speechWin || event.sender !== speechWin.webContents) return;
  speechCardSize = size;
  placeSpeech();
});
ipcMain.on('speech-click', () => {
  if (win && !win.isDestroyed()) win.webContents.send('speech-clicked');
});

function showPendingTipIfAny() {
  if (pendingTip && !isBusy()) {
    const kind = pendingTip;
    pendingTip = null;
    triggerBubble(kind);
  }
}

function startBreathingExercise() {
  if (breathingActive || !win || win.isDestroyed()) return;
  breathingActive = true;
  pauseWalk('breathing');
  win.webContents.send('start-breathing', {
    cycleMs: BREATHING_CYCLE_MS,
    cycles: BREATHING_CYCLES,
    countdownMs: BREATHING_COUNTDOWN_MS,
  });
  breathingTimeout = setTimeout(endBreathingExercise, BREATHING_COUNTDOWN_MS + BREATHING_CYCLE_MS * BREATHING_CYCLES);
}

// showRepeatPrompt=false só no caso de "me dá uma dica agora" durante o
// exercício: aí a intenção explícita é ver a dica, não repetir a respiração
function endBreathingExercise(showRepeatPrompt = true) {
  if (!breathingActive) return;
  breathingActive = false;
  if (breathingTimeout) clearTimeout(breathingTimeout);
  breathingTimeout = null;
  if (win && !win.isDestroyed()) win.webContents.send('end-breathing');
  // segura o sol parado até a lua terminar de virar sol de novo (mesma
  // animação de sempre); só então mostra o convite pra repetir (ou, se não
  // for o caso, retoma a caminhada e mostra a dica pendente na hora — se
  // ela aparecesse antes, cortaria a transição)
  setTimeout(() => {
    if (showRepeatPrompt && win && !win.isDestroyed()) {
      win.webContents.send('breathing-done-prompt');
    } else {
      resumeWalk('breathing');
      showPendingTipIfAny();
    }
  }, BREATHING_EXIT_ANIM_MS);
}

// o convite "toque pra respirar de novo" não foi aceito (tocou fora ou
// esperou demais): aí sim retoma a caminhada e mostra a dica pendente
function dismissBreathingPrompt() {
  resumeWalk('breathing');
  showPendingTipIfAny();
}

// "me dá uma dica agora": se estiver no modo respiração, encerra ele (com a
// mesma animação de virar sol de volta) e a dica aparece assim que o sol
// estiver de volta ao normal, em vez de esperar o exercício terminar sozinho
function requestTipNow() {
  if (tipTimeout) clearTimeout(tipTimeout);
  triggerBubble('calm');
  if (breathingActive) endBreathingExercise(false);
  scheduleNextTip();
}

function openCustomFrequencyPrompt() {
  if (freqPromptWin && !freqPromptWin.isDestroyed()) {
    freqPromptWin.focus();
    return;
  }
  const area = currentWorkArea();
  const sunBounds = win && !win.isDestroyed() ? win.getBounds() : { x: area.x, y: area.y - WIN_H, width: WIN_W };
  const { x, y } = computeFreqPromptPosition(sunBounds, area);

  pauseWalk('freqPrompt');

  const f = new BrowserWindow({
    width: FREQ_PROMPT_W,
    height: FREQ_PROMPT_H,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'frequency-preload.js'),
      contextIsolation: true,
    },
  });
  freqPromptWin = f;
  f.setAlwaysOnTop(true, 'screen-saver');
  f.loadFile(path.join(__dirname, 'renderer', 'frequency-prompt.html'));
  f.webContents.once('did-finish-load', () => {
    if (f.isDestroyed()) return;
    f.webContents.send('current-frequency', {
      minutes: settings.frequencyMinutes,
      language: settings.language,
    });
  });
  f.on('blur', () => {
    if (!f.isDestroyed()) f.close();
  });
  f.on('closed', () => {
    if (freqPromptWin !== f) return;
    freqPromptWin = null;
    resumeWalk('freqPrompt');
    showPendingTipIfAny();
  });
}

// status: 'ready' (baixou, pode instalar agora), 'up-to-date', 'error' ou
// 'dev-mode' (checagem manual rodando fora do app instalado)
function openUpdatePrompt(payload) {
  if (updatePromptWin && !updatePromptWin.isDestroyed()) {
    updatePromptWin.webContents.send('update-status', payload);
    updatePromptWin.focus();
    return;
  }
  const area = currentWorkArea();
  const sunBounds = win && !win.isDestroyed() ? win.getBounds() : { x: area.x, y: area.y - WIN_H, width: WIN_W };
  const { x, y } = computeUpdatePromptPosition(sunBounds, area);

  pauseWalk('updatePrompt');

  const u = new BrowserWindow({
    width: UPDATE_PROMPT_W,
    height: UPDATE_PROMPT_H,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'update-preload.js'),
      contextIsolation: true,
    },
  });
  updatePromptWin = u;
  u.setAlwaysOnTop(true, 'screen-saver');
  u.loadFile(path.join(__dirname, 'renderer', 'update-prompt.html'));
  u.webContents.once('did-finish-load', () => {
    if (!u.isDestroyed()) u.webContents.send('update-status', { ...payload, language: settings.language });
  });
  u.on('blur', () => {
    if (!u.isDestroyed()) u.close();
  });
  u.on('closed', () => {
    if (updatePromptWin !== u) return;
    updatePromptWin = null;
    resumeWalk('updatePrompt');
  });
}

// enquanto procura uma atualização (reais ou simuladas em dev), a coroa
// solar gira rápido — dá um retorno visual de "buscando", já que a
// checagem silenciosa não mostra popup nenhum na maioria das vezes
let checkingUpdateStartedAt = 0;
// a checagem de verdade (só bate na API do GitHub) costuma terminar rápido
// demais pro giro chegar a aparecer — sem isso, na prática nunca dava pra
// ver a animação de "buscando" numa instalação de verdade, só na simulação
// do modo desenvolvimento (que já tinha um atraso fixo de propósito)
const MIN_CHECKING_UPDATE_MS = 1400;

function setCheckingUpdate(active) {
  if (active) checkingUpdateStartedAt = Date.now();
  if (win && !win.isDestroyed()) win.webContents.send('checking-update', active);
}

// desliga o giro só depois do tempo mínimo ter passado (mesmo que a
// checagem de verdade já tenha terminado antes), só então roda o que
// precisa acontecer depois (mostrar popup, etc.)
function stopCheckingUpdate(after) {
  const elapsed = Date.now() - checkingUpdateStartedAt;
  const wait = Math.max(0, MIN_CHECKING_UPDATE_MS - elapsed);
  setTimeout(() => {
    setCheckingUpdate(false);
    if (after) after();
  }, wait);
}

function initAutoUpdater() {
  if (!app.isPackaged) return; // sem versão instalada não tem o que checar
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => setCheckingUpdate(true));
  autoUpdater.on('update-downloaded', (info) => {
    stopCheckingUpdate(() => openUpdatePrompt({ status: 'ready', version: info.version }));
  });
  autoUpdater.on('update-not-available', () => {
    stopCheckingUpdate(() => {
      if (manualUpdateCheck) openUpdatePrompt({ status: 'up-to-date' });
      manualUpdateCheck = false;
    });
  });
  autoUpdater.on('error', () => {
    stopCheckingUpdate(() => {
      if (manualUpdateCheck) openUpdatePrompt({ status: 'error' });
      manualUpdateCheck = false;
    });
  });

  // checa uma vez por sessão, sem pressa — o app já abre sozinho a cada
  // login, então uma checagem silenciosa no início já é o bastante
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => stopCheckingUpdate()), 15000);
}

function checkForUpdatesNow() {
  if (!app.isPackaged) {
    // sem instalação real não tem autoUpdater de verdade, mas ainda dá pra
    // validar a animação de "buscando" no modo desenvolvimento
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      openUpdatePrompt({ status: 'dev-mode' });
    }, 1600);
    return;
  }
  manualUpdateCheck = true;
  autoUpdater.checkForUpdates().catch(() => {
    stopCheckingUpdate(() => {
      if (manualUpdateCheck) openUpdatePrompt({ status: 'error' });
      manualUpdateCheck = false;
    });
  });
}

// Abre uma issue nova no GitHub já preenchida com a versão e o sistema —
// só isso, não manda nada sozinho: a pessoa ainda revisa e clica em
// "Submit" no navegador dela.
function reportBug() {
  const body = [
    '<!-- descreva o que aconteceu, o que você esperava, e como reproduzir -->',
    '',
    '---',
    `Versão do solzinho: ${app.getVersion()}`,
    `Sistema: ${process.platform} ${require('os').release()}`,
    `Idioma: ${settings.language}`,
  ].join('\n');
  const url =
    'https://github.com/wallasace/solzinho/issues/new?' +
    `title=${encodeURIComponent('[bug] ')}&body=${encodeURIComponent(body)}`;
  shell.openExternal(url);
}

function openContextMenu() {
  // Fecha o menu anterior na hora (destroy, não close): o close() é
  // assíncrono, e o "closed" do menu antigo chegava depois de o novo já ter
  // sido criado — e apagava a referência do novo, deixando-o órfão.
  if (menuWin && !menuWin.isDestroyed()) {
    const old = menuWin;
    menuWin = null;
    old.destroy();
  }

  const area = currentWorkArea();
  const sunBounds = win && !win.isDestroyed() ? win.getBounds() : { x: area.x, y: area.y - WIN_H, width: WIN_W };
  const { x, y } = computeMenuPosition(sunBounds, area);

  pauseWalk('menu');

  const m = new BrowserWindow({
    width: MENU_W,
    height: MENU_H,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'context-menu-preload.js'),
      contextIsolation: true,
    },
  });
  menuWin = m;
  m.setAlwaysOnTop(true, 'screen-saver');
  m.loadFile(path.join(__dirname, 'renderer', 'context-menu.html'));
  m.webContents.once('did-finish-load', () => {
    if (m.isDestroyed()) return;
    m.webContents.send('menu-state', {
      tipsPaused: settings.tipsPaused,
      walking: settings.walking,
      frequencyMinutes: settings.frequencyMinutes,
      isCustom: !FREQUENCY_OPTIONS.includes(settings.frequencyMinutes),
      frequencyOptions: FREQUENCY_OPTIONS,
      language: settings.language,
      muted: settings.muted,
      autoLaunch: settings.autoLaunch,
      sunglasses: settings.sunglasses,
    });
  });
  m.on('blur', () => {
    if (!m.isDestroyed()) m.close();
  });
  // cada janela só mexe no estado se ainda for o menu atual
  m.on('closed', () => {
    if (menuWin !== m) return;
    menuWin = null;
    resumeWalk('menu');
    showPendingTipIfAny();
  });
}

function handleMenuAction(action, value) {
  switch (action) {
    case 'toggle-tips':
      settings.tipsPaused = !settings.tipsPaused;
      saveSettings();
      if (win && !win.isDestroyed()) win.webContents.send('tips-paused-changed', settings.tipsPaused);
      break;
    case 'set-frequency':
      settings.frequencyMinutes = value;
      saveSettings();
      scheduleNextTip();
      break;
    case 'custom-frequency':
      openCustomFrequencyPrompt();
      break;
    case 'toggle-walking':
      settings.walking = !settings.walking;
      saveSettings();
      if (win) win.webContents.send('state', settings.walking ? 'walk' : 'idle');
      break;
    case 'request-tip':
      requestTipNow();
      break;
    case 'breathing-exercise':
      startBreathingExercise();
      break;
    case 'set-language':
      settings.language = value;
      saveSettings();
      if (win && !win.isDestroyed()) win.webContents.send('language-changed', value);
      break;
    case 'toggle-mute':
      settings.muted = !settings.muted;
      saveSettings();
      if (win && !win.isDestroyed()) win.webContents.send('mute-changed', settings.muted);
      break;
    case 'toggle-auto-launch':
      settings.autoLaunch = !settings.autoLaunch;
      saveSettings();
      registerAutoLaunch();
      break;
    case 'toggle-sunglasses':
      settings.sunglasses = !settings.sunglasses;
      saveSettings();
      if (win && !win.isDestroyed()) win.webContents.send('sunglasses-changed', settings.sunglasses);
      break;
    case 'check-for-updates':
      checkForUpdatesNow();
      break;
    case 'report-bug':
      reportBug();
      break;
    case 'quit':
      app.quit();
      break;
    default:
      break;
  }
  if (menuWin) menuWin.close();
}

// A janela do sol deixa o mouse atravessar, exceto sobre o sol e sobre o
// balão/painel de respiração. Quem decide é este verificador, olhando o
// cursor pelo sistema: o repasse de mouse do Windows (forward) informa a
// posição errada em monitor com escala != 100%, e o sol ficava impossível
// de clicar/arrastar depois de mudar de tela.
let mouseIgnored = true;
let hoverTimer = null;

function setMouseIgnored(ignore) {
  if (ignore === mouseIgnored || !win || win.isDestroyed()) return;
  mouseIgnored = ignore;
  win.setIgnoreMouseEvents(ignore, { forward: true });
}

function hoverTick() {
  if (!win || win.isDestroyed()) return;
  if (dragging) {
    setMouseIgnored(false);
    return;
  }
  const c = screen.getCursorScreenPoint();
  const sun = sunVisualRect();
  const overSun = c.x >= sun.x && c.x <= sun.x + sun.width && c.y >= sun.y && c.y <= sun.y + sun.height;
  setMouseIgnored(!overSun);
}

ipcMain.on('request-tip', () => {
  requestTipNow();
});

ipcMain.on('bubble-dismissed', () => {
  resumeWalk('bubble');
});

// O arraste lê o cursor aqui no processo principal (screen.getCursorScreenPoint),
// não as coordenadas que o renderer manda: com monitores de escalas diferentes
// (ex.: 100% e 150%) as coordenadas do renderer ficam erradas ao cruzar de tela.
// Velocidade estimada durante o arraste (px/s), suavizada entre os ticks,
// usada pra decidir o "impulso" do sol quando ele é solto em movimento.
let dragLastPos = null;
let dragLastTime = null;
let dragVelocity = { x: 0, y: 0 };

function dragTick() {
  if (!dragging || !win || win.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const wantX = dragStartBounds.x + (cursor.x - dragStartMouse.x);
  const wantY = dragStartBounds.y + (cursor.y - dragStartMouse.y);
  // vale o monitor onde o sol vai ficar — qualquer um dos monitores
  const area = screen.getDisplayNearestPoint(sunCenter({ x: wantX, y: wantY })).workArea;
  const { x, y } = clampSunWindowPosition(wantX, wantY, area);

  const now = Date.now();
  if (dragLastPos && dragLastTime) {
    const dt = Math.max(now - dragLastTime, 1) / 1000;
    dragVelocity.x = dragVelocity.x * 0.5 + ((x - dragLastPos.x) / dt) * 0.5;
    dragVelocity.y = dragVelocity.y * 0.5 + ((y - dragLastPos.y) / dt) * 0.5;
  }
  dragLastPos = { x, y };
  dragLastTime = now;

  setSunBounds(x, y);
  repositionFollowerWindows();
}

function stopDrag() {
  dragging = false;
  dragStartMouse = null;
  dragStartBounds = null;
  const throwVelocity = dragVelocity;
  dragLastPos = null;
  dragLastTime = null;
  dragVelocity = { x: 0, y: 0 };
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
  if (displayChangePending && win && !win.isDestroyed()) refreshInputAfterDisplayChange();
  startFlingIfFast(throwVelocity);
}

ipcMain.on('drag-start', () => {
  if (!win || win.isDestroyed()) return;
  stopFling(); // se estava sacudindo o sol de novo enquanto ele quicava
  dragging = true;
  dragStartMouse = screen.getCursorScreenPoint();
  dragStartBounds = { ...getSunPos() };
  dragLastPos = null;
  dragLastTime = null;
  dragVelocity = { x: 0, y: 0 };
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = setInterval(dragTick, 16);
});

// ---- Física do arremesso ----
// Soltar o sol em movimento continua o movimento dele: perde velocidade aos
// poucos (atrito) e quica nas bordas da tela (perde parte da velocidade a
// cada batida), como se tivesse física de verdade. Fica no mesmo monitor de
// onde foi solto — assim como andar sozinho, arremessar não troca de tela.
const FLING_MIN_SPEED = 60; // px/s abaixo disso nem começa (ex.: só um clique)
const FLING_FRICTION = 0.985; // por tick de 16ms, no "cruzeiro" do arremesso
// reta final: abaixo de FLING_EASE_SPEED, troca pra um freio bem mais forte
// (~0.5s até quase zero) em vez de deixar o atrito normal correr até um corte
// seco — sem isso, ele simplesmente "travava" de repente no fim
const FLING_EASE_SPEED = 140;
const FLING_EASE_FRICTION = 0.9;
const FLING_BOUNCE = 0.55; // fração da velocidade que sobra depois de bater na borda
const FLING_STOP_SPEED = 4; // px/s abaixo disso, considera que já parou de vez
let flingTimer = null;
let flingVel = null;

function startFlingIfFast(v) {
  if (Math.hypot(v.x, v.y) < FLING_MIN_SPEED) return;
  flingVel = { ...v };
  pauseWalk('fling');
  if (win && !win.isDestroyed()) {
    win.webContents.send('flinging', true);
    win.webContents.send('fling-speed', Math.hypot(v.x, v.y));
  }
  if (flingTimer) clearInterval(flingTimer);
  flingTimer = setInterval(flingTick, 16);
}

function flingTick() {
  if (!flingVel || !win || win.isDestroyed()) {
    stopFling();
    return;
  }
  const dt = 0.016;
  const pos = getSunPos();
  const rawX = pos.x + flingVel.x * dt;
  const rawY = pos.y + flingVel.y * dt;
  const area = screen.getDisplayNearestPoint(sunCenter({ x: rawX, y: rawY })).workArea;
  const { x, y } = clampSunWindowPosition(rawX, rawY, area);

  const hitX = x !== Math.round(rawX);
  const hitY = y !== Math.round(rawY);
  if (hitX) flingVel.x = -flingVel.x * FLING_BOUNCE;
  if (hitY) flingVel.y = -flingVel.y * FLING_BOUNCE;
  const speed = Math.hypot(flingVel.x, flingVel.y);
  const friction = speed < FLING_EASE_SPEED ? FLING_EASE_FRICTION : FLING_FRICTION;
  flingVel.x *= friction;
  flingVel.y *= friction;

  // só avisa a "batida" (som + amassado) quando bate com alguma força — perto
  // do fim do arremesso ele quica de leve várias vezes e isso ficaria irritante
  const impactSpeed = Math.max(hitX ? Math.abs(flingVel.x) : 0, hitY ? Math.abs(flingVel.y) : 0);
  if (impactSpeed > 40) {
    win.webContents.send('bounce', { axis: hitX ? 'x' : 'y', speed: impactSpeed });
  }

  setSunBounds(x, y);
  if (Math.abs(flingVel.x) > 5) win.webContents.send('face-direction', flingVel.x < 0 ? -1 : 1);
  repositionFollowerWindows();

  const currentSpeed = Math.hypot(flingVel.x, flingVel.y);
  win.webContents.send('fling-speed', currentSpeed);
  if (currentSpeed < FLING_STOP_SPEED) stopFling();
}

function stopFling() {
  if (!flingTimer && !flingVel) return;
  if (flingTimer) clearInterval(flingTimer);
  flingTimer = null;
  if (flingVel && Math.abs(flingVel.x) > 1) direction = flingVel.x > 0 ? 1 : -1;
  flingVel = null;
  resumeWalk('fling');
  if (win && !win.isDestroyed()) win.webContents.send('flinging', false);
}

ipcMain.on('drag-end', stopDrag);

ipcMain.on('show-context-menu', () => {
  openContextMenu();
});

ipcMain.on('menu-action', (_event, { action, value }) => {
  handleMenuAction(action, value);
});

ipcMain.on('set-custom-frequency', (_event, minutes) => {
  const value = Math.max(1, Math.round(Number(minutes) || settings.frequencyMinutes));
  settings.frequencyMinutes = value;
  saveSettings();
  scheduleNextTip();
  if (freqPromptWin) freqPromptWin.close();
});

ipcMain.on('cancel-custom-frequency', () => {
  if (freqPromptWin) freqPromptWin.close();
});

ipcMain.on('update-now', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('update-later', () => {
  if (updatePromptWin) updatePromptWin.close();
});

ipcMain.on('stop-breathing-request', () => {
  endBreathingExercise();
});

ipcMain.on('breathing-prompt-dismissed', () => {
  dismissBreathingPrompt();
});

ipcMain.on('breathing-again-request', () => {
  startBreathingExercise();
});

function registerAutoLaunch() {
  // só faz sentido para o app instalado (electron-builder); em modo dev,
  // process.execPath aponta pro electron.exe do node_modules, não pro app.
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch, path: process.execPath });
}

// Se um monitor for desconectado, mudar de resolução ou de escala com o app
// aberto, o sol pode ficar numa posição que não existe mais — traz ele de
// volta pro monitor mais próximo.
function keepSunOnScreen() {
  if (!win || win.isDestroyed()) return;
  const pos = getSunPos();
  const area = screen.getDisplayNearestPoint(sunCenter(pos)).workArea;
  const { x, y } = clampSunWindowPosition(pos.x, pos.y, area);
  setSunBounds(x, y);
  repositionFollowerWindows();
}

app.whenReady().then(() => {
  registerAutoLaunch();
  createWindow();
  initAutoUpdater();
  screen.on('display-removed', keepSunOnScreen);
  screen.on('display-added', keepSunOnScreen);
  screen.on('display-metrics-changed', keepSunOnScreen);
});

app.on('window-all-closed', () => {
  if (tickTimer) clearInterval(tickTimer);
  if (idleTimeout) clearTimeout(idleTimeout);
  if (idleResumeTimeout) clearTimeout(idleResumeTimeout);
  if (tipTimeout) clearTimeout(tipTimeout);
  if (physicalTipTimeout) clearTimeout(physicalTipTimeout);
  if (breathingTimeout) clearTimeout(breathingTimeout);
  if (dragTimer) clearInterval(dragTimer);
  if (hoverTimer) clearInterval(hoverTimer);
  if (flingTimer) clearInterval(flingTimer);
  app.quit();
});
