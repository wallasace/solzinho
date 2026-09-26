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
const SUN_VISUAL_TOP_MARGIN = 10 + 96;

function getSunAnchorTop(sunBounds) {
  return sunBounds.y + WIN_H - SUN_VISUAL_TOP_MARGIN;
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

// Área útil do monitor onde o sol está de fato (não sempre o monitor
// primário) — importante em setups com mais de uma tela, senão o sol fica
// preso só na tela primária mesmo tendo sido levado pra outra.
function currentWorkArea(bounds) {
  if (bounds) return screen.getDisplayMatching(bounds).workArea;
  if (win && !win.isDestroyed()) return screen.getDisplayMatching(win.getBounds()).workArea;
  return screen.getPrimaryDisplay().workArea;
}

function createWindow() {
  const area = currentWorkArea();
  const x = area.x + Math.floor((area.width - WIN_W) / 2);
  const y = area.y + area.height - WIN_H;

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
  scheduleNextIdle();
  scheduleNextTip();
  scheduleNextPhysicalTip();
}

function startWalking() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!settings.walking || isWalkPaused() || dragging || !win || win.isDestroyed()) return;
    const area = currentWorkArea();
    const bounds = win.getBounds();
    let nextX = bounds.x + direction * BASE_SPEED;

    const minX = area.x + EDGE_MARGIN;
    const maxX = area.x + area.width - WIN_W - EDGE_MARGIN;

    if (nextX <= minX) {
      nextX = minX;
      direction = 1;
    } else if (nextX >= maxX) {
      nextX = maxX;
      direction = -1;
    }

    win.setBounds({ x: Math.round(nextX), y: bounds.y, width: WIN_W, height: WIN_H });
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

ipcMain.on('set-mouse-ignore', (_event, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('request-tip', () => {
  if (tipTimeout) clearTimeout(tipTimeout);
  triggerBubble();
  scheduleNextTip();
});

ipcMain.on('bubble-dismissed', () => {
  resumeWalk('bubble');
});

ipcMain.on('drag-start', (_event, pos) => {
  if (!win || win.isDestroyed()) return;
  dragging = true;
  dragStartMouse = pos;
  dragStartBounds = win.getBounds();
});

ipcMain.on('drag-move', (_event, pos) => {
  if (!dragging || !dragStartMouse || !dragStartBounds || !win || win.isDestroyed()) return;
  // usa o monitor do cursor (não o do sol antes do movimento), pra travar
  // certinho assim que ele cruza pra outra tela, sem atraso de um frame
  const area = screen.getDisplayNearestPoint({ x: pos.screenX, y: pos.screenY }).workArea;
  const dx = pos.screenX - dragStartMouse.screenX;
  const dy = pos.screenY - dragStartMouse.screenY;
  const minX = area.x;
  const maxX = area.x + area.width - WIN_W;
  const minY = area.y;
  const maxY = area.y + area.height - WIN_H;
  const x = Math.min(Math.max(Math.round(dragStartBounds.x + dx), minX), maxX);
  const y = Math.min(Math.max(Math.round(dragStartBounds.y + dy), minY), maxY);
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
  repositionFollowerWindows();
});

ipcMain.on('drag-end', () => {
  dragging = false;
  dragStartMouse = null;
  dragStartBounds = null;
});

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

app.whenReady().then(() => {
  registerAutoLaunch();
  createWindow();
});

app.on('window-all-closed', () => {
  if (tickTimer) clearInterval(tickTimer);
  if (idleTimeout) clearTimeout(idleTimeout);
  if (idleResumeTimeout) clearTimeout(idleResumeTimeout);
  if (tipTimeout) clearTimeout(tipTimeout);
  if (physicalTipTimeout) clearTimeout(physicalTipTimeout);
  if (breathingTimeout) clearTimeout(breathingTimeout);
  app.quit();
});
