const { app, BrowserWindow, Tray, Menu, Notification, screen, ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const UI = path.join(__dirname, 'ui');
let tray, flyout, toast, toastTimer, blinkTimer;
let battery = null;          // letzter Zustand vom Renderer
let warned = false, blinkOn = false;
let sim = null;              // --simulate Wert
let settings = { threshold: 15 };
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// ---------- CLI-Argumente (auch von einer zweiten Instanz)
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--simulate') out.simulate = argv[++i];
    else if (argv[i].startsWith('--simulate=')) out.simulate = argv[i].split('=')[1];
    else if (argv[i] === '--test-warning') out.testWarning = true;
    else if (argv[i] === '--show') out.show = true;
    else if (argv[i] === '--quit') out.quit = true;
  }
  return out;
}
function handleArgs(a) {
  if (a.quit) return app.quit();
  if (a.simulate) { sim = a.simulate; loadFlyout(); }
  if (a.testWarning) showToast(battery ? battery.percent : 14);
  if (a.show) showFlyout();
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => handleArgs(parseArgs(argv.slice(1))));

// ---------- Einstellungen
function loadSettings() { try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch {} }
function saveSettings() { try { fs.writeFileSync(settingsFile(), JSON.stringify({ threshold: settings.threshold })); } catch {} }
const publicSettings = () => ({ threshold: settings.threshold, autostart: app.getLoginItemSettings().openAtLogin });

// ---------- Fenster
function loadFlyout() {
  const q = sim ? { query: { sim } } : {};
  flyout.loadFile(path.join(UI, 'flyout.html'), q);
}
function createFlyout() {
  flyout = new BrowserWindow({
    width: 360, height: 548, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    backgroundColor: '#0A0D12', fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, contextIsolation: true },
  });
  loadFlyout();
  flyout.on('blur', () => flyout.hide());
}
function showFlyout() {
  const wa = screen.getDisplayNearestPoint(tray.getBounds()).workArea;
  const tb = tray.getBounds(), { width, height } = flyout.getBounds();
  const x = Math.min(Math.max(tb.x + tb.width / 2 - width / 2, wa.x + 8), wa.x + wa.width - width - 8);
  const y = Math.max(wa.y + 8, wa.y + wa.height - height - 12);
  flyout.setPosition(Math.round(x), Math.round(y));
  flyout.show(); flyout.focus();
}
function showToast(percent) {
  closeToast();
  const wa = screen.getPrimaryDisplay().workArea, w = 400, h = 132;
  toast = new BrowserWindow({
    width: w, height: h, x: wa.x + wa.width - w - 8, y: wa.y + wa.height - h - 8,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  toast.setAlwaysOnTop(true, 'screen-saver');
  toast.loadFile(path.join(UI, 'toast.html'), { query: { p: String(percent) } });
  toast.once('ready-to-show', () => toast.showInactive());
  toastTimer = setTimeout(closeToast, 12000);
}
function closeToast() {
  clearTimeout(toastTimer);
  if (toast && !toast.isDestroyed()) toast.close();
  toast = null;
}

// ---------- Tray / Warnlogik
const img = (url) => nativeImage.createFromDataURL(url);
function tooltip(b) {
  const lbl = b.plugged ? (b.percent >= 100 ? 'voll' : 'lädt') : 'Akkubetrieb';
  let t = `Akku ${b.percent}% – ${lbl}`;
  if (!b.plugged && b.secs) t += ` – noch ${Math.floor(b.secs / 3600)}:${String(Math.floor((b.secs % 3600) / 60)).padStart(2, '0')} h`;
  return t;
}
function onBattery(b) {
  battery = b;
  tray.setImage(img(b.icons.normal));
  tray.setToolTip(tooltip(b));
  const critical = !b.plugged && b.percent <= settings.threshold;
  if (critical) {
    if (!blinkTimer) blinkTimer = setInterval(() => { blinkOn = !blinkOn; tray.setImage(img(blinkOn ? battery.icons.alt : battery.icons.normal)); }, 700);
    if (!warned) {
      warned = true;
      showToast(b.percent);
      if (Notification.isSupported()) new Notification({ title: `Akku nur noch ${b.percent}%`, body: 'Bitte jetzt das Netzteil anschließen.', urgency: 'critical' }).show();
    }
  } else {
    clearInterval(blinkTimer); blinkTimer = null; blinkOn = false;
    if (b.plugged || b.percent > settings.threshold + 5) warned = false;
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Öffnen', click: showFlyout },
    { label: 'Warnung testen', click: () => showToast(battery ? battery.percent : 14) },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
}

app.whenReady().then(() => {
  app.setAppUserModelId('de.taskpercent.app');
  loadSettings();
  const first = parseArgs(process.argv.slice(1));
  if (first.simulate) sim = first.simulate;
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('taskPercent');
  tray.on('click', () => (flyout.isVisible() ? flyout.hide() : showFlyout()));
  tray.setContextMenu(buildMenu());
  createFlyout();
  if (first.testWarning) setTimeout(() => showToast(14), 800);
  if (first.show) flyout.once('ready-to-show', showFlyout);
});

app.on('window-all-closed', (e) => e.preventDefault()); // Tray-App bleibt offen

ipcMain.on('battery:report', (_e, b) => onBattery(b));
ipcMain.handle('settings:get', publicSettings);
ipcMain.on('settings:set', (_e, s) => {
  settings.threshold = s.threshold; saveSettings();
  app.setLoginItemSettings({ openAtLogin: !!s.autostart });
  warned = false;
  if (battery) onBattery(battery);
});
ipcMain.on('toast:test', () => showToast(battery ? battery.percent : 14));
ipcMain.on('toast:close', closeToast);
ipcMain.on('app:quit', () => app.quit());
