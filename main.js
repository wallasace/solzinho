const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
let breathingActive = false;
let breathingTimeout = null;

const BREATHING_CYCLE_MS = 16000; // inspira 4s + segura 4s + solta 4s + segura 4s
const BREATHING_CYCLES = 4;
const BREATHING_COUNTDOWN_MS = 3000;

const MENU_W = 260;
const MENU_H = 430;
const FREQ_PROMPT_W = 280;
const FREQ_PROMPT_H = 150;
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
  { frequencyMinutes: 30, tipsPaused: false, walking: true, language: 'pt' },
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
  ensureBubbleRoom();
  win.webContents.send('show-bubble', kind);
}

// O balão mora na parte invisível da janela, acima e dos lados do sol. Se o
// sol estiver encostado numa borda, essa parte está fora da tela — então
// traz a janela inteira pra dentro antes de falar.
function ensureBubbleRoom() {
  const pos = getSunPos();
  const area = currentWorkArea();
  const x = Math.min(Math.max(pos.x, area.x), area.x + area.width - WIN_W);
  const y = Math.max(pos.y, area.y);
  if (x !== pos.x || y !== pos.y) setSunBounds(x, y);
}

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
  ensureBubbleRoom();
  win.webContents.send('start-breathing', {
    cycleMs: BREATHING_CYCLE_MS,
    cycles: BREATHING_CYCLES,
    countdownMs: BREATHING_COUNTDOWN_MS,
  });
  breathingTimeout = setTimeout(endBreathingExercise, BREATHING_COUNTDOWN_MS + BREATHING_CYCLE_MS * BREATHING_CYCLES);
}

function endBreathingExercise() {
  if (!breathingActive) return;
  breathingActive = false;
  if (breathingTimeout) clearTimeout(breathingTimeout);
  breathingTimeout = null;
  resumeWalk('breathing');
  if (win && !win.isDestroyed()) win.webContents.send('end-breathing');
  showPendingTipIfAny();
}

function openCustomFrequencyPrompt() {
  if (freqPromptWin) {
    freqPromptWin.focus();
    return;
  }
  const area = currentWorkArea();
  const sunBounds = win && !win.isDestroyed() ? win.getBounds() : { x: area.x, y: area.y - WIN_H, width: WIN_W };
  const { x, y } = computeFreqPromptPosition(sunBounds, area);

  pauseWalk('freqPrompt');

  freqPromptWin = new BrowserWindow({
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
  freqPromptWin.setAlwaysOnTop(true, 'screen-saver');
  freqPromptWin.loadFile(path.join(__dirname, 'renderer', 'frequency-prompt.html'));
  freqPromptWin.webContents.once('did-finish-load', () => {
    if (freqPromptWin) {
      freqPromptWin.webContents.send('current-frequency', {
        minutes: settings.frequencyMinutes,
        language: settings.language,
      });
    }
  });
  freqPromptWin.on('blur', () => {
    if (freqPromptWin) freqPromptWin.close();
  });
  freqPromptWin.on('closed', () => {
    freqPromptWin = null;
    resumeWalk('freqPrompt');
    showPendingTipIfAny();
  });
}

function openContextMenu() {
  if (menuWin) {
    menuWin.close();
  }

  const area = currentWorkArea();
  const sunBounds = win && !win.isDestroyed() ? win.getBounds() : { x: area.x, y: area.y - WIN_H, width: WIN_W };
  const { x, y } = computeMenuPosition(sunBounds, area);

  pauseWalk('menu');

  menuWin = new BrowserWindow({
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
  menuWin.setAlwaysOnTop(true, 'screen-saver');
  menuWin.loadFile(path.join(__dirname, 'renderer', 'context-menu.html'));
  menuWin.webContents.once('did-finish-load', () => {
    if (!menuWin) return;
    menuWin.webContents.send('menu-state', {
      tipsPaused: settings.tipsPaused,
      walking: settings.walking,
      frequencyMinutes: settings.frequencyMinutes,
      isCustom: !FREQUENCY_OPTIONS.includes(settings.frequencyMinutes),
      frequencyOptions: FREQUENCY_OPTIONS,
      language: settings.language,
    });
  });
  menuWin.on('blur', () => {
    if (menuWin) menuWin.close();
  });
  menuWin.on('closed', () => {
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
      if (tipTimeout) clearTimeout(tipTimeout);
      triggerBubble();
      scheduleNextTip();
      break;
    case 'breathing-exercise':
      startBreathingExercise();
      break;
    case 'set-language':
      settings.language = value;
      saveSettings();
      if (win && !win.isDestroyed()) win.webContents.send('language-changed', value);
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
let interactiveRects = []; // balão/painel visíveis, em px relativos à janela
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
  const cursor = screen.getCursorScreenPoint();
  const pos = getSunPos();
  const rel = { x: cursor.x - Math.round(pos.x), y: cursor.y - Math.round(pos.y) };
  const sunRect = { x: SUN_SIDE_OFFSET, y: WIN_H - SUN_VISUAL_TOP_MARGIN, width: SUN_SIZE, height: SUN_SIZE };
  const overSomething = [sunRect, ...interactiveRects].some(
    (r) => rel.x >= r.x && rel.x <= r.x + r.width && rel.y >= r.y && rel.y <= r.y + r.height
  );
  setMouseIgnored(!overSomething);
}

ipcMain.on('set-interactive-rects', (_event, rects) => {
  interactiveRects = Array.isArray(rects) ? rects : [];
});

ipcMain.on('request-tip', () => {
  if (tipTimeout) clearTimeout(tipTimeout);
  triggerBubble();
  scheduleNextTip();
});

ipcMain.on('bubble-dismissed', () => {
  resumeWalk('bubble');
});

// O arraste lê o cursor aqui no processo principal (screen.getCursorScreenPoint),
// não as coordenadas que o renderer manda: com monitores de escalas diferentes
// (ex.: 100% e 150%) as coordenadas do renderer ficam erradas ao cruzar de tela.
function dragTick() {
  if (!dragging || !win || win.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const wantX = dragStartBounds.x + (cursor.x - dragStartMouse.x);
  const wantY = dragStartBounds.y + (cursor.y - dragStartMouse.y);
  // vale o monitor onde o sol vai ficar — qualquer um dos monitores
  const area = screen.getDisplayNearestPoint(sunCenter({ x: wantX, y: wantY })).workArea;
  const { x, y } = clampSunWindowPosition(wantX, wantY, area);
  setSunBounds(x, y);
  repositionFollowerWindows();
}

function stopDrag() {
  dragging = false;
  dragStartMouse = null;
  dragStartBounds = null;
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
  if (displayChangePending && win && !win.isDestroyed()) refreshInputAfterDisplayChange();
}

ipcMain.on('drag-start', () => {
  if (!win || win.isDestroyed()) return;
  dragging = true;
  dragStartMouse = screen.getCursorScreenPoint();
  dragStartBounds = { ...getSunPos() };
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = setInterval(dragTick, 16);
});

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

ipcMain.on('stop-breathing-request', () => {
  endBreathingExercise();
});

function registerAutoLaunch() {
  // só faz sentido para o app instalado (electron-builder); em modo dev,
  // process.execPath aponta pro electron.exe do node_modules, não pro app.
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
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
  app.quit();
});
