const { app, BrowserWindow, Tray, Menu, Notification, screen, ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const native = require('./native');
const admin = require('./admin');

const UI = path.join(__dirname, 'ui');
let tray, flyout, devices, toast, toastTimer, blinkTimer;
let battery = null;          // letzter Zustand vom Renderer
let warned = false, blinkOn = false;
let sim = null;              // --simulate Wert
let settings = { threshold: 15, pinned: [] };
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// ---------- CLI-Argumente (auch von einer zweiten Instanz)
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--simulate') out.simulate = argv[++i];
    else if (argv[i].startsWith('--simulate=')) out.simulate = argv[i].split('=')[1];
    else if (argv[i] === '--test-warning') out.testWarning = true;
    else if (argv[i] === '--show') out.show = true;
    else if (argv[i] === '--devices') out.devices = true;
    else if (argv[i] === '--quit') out.quit = true;
  }
  return out;
}
function handleArgs(a) {
  if (a.quit) return app.quit();
  if (a.simulate) { sim = a.simulate; loadFlyout(); }
  if (a.testWarning) showToast(battery ? battery.percent : 14);
  if (a.show) showFlyout();
  if (a.devices) showDevices();
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => handleArgs(parseArgs(argv.slice(1))));

// ---------- Einstellungen
function loadSettings() { try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch {} }
function saveSettings() { try { fs.writeFileSync(settingsFile(), JSON.stringify({ threshold: settings.threshold, pinned: settings.pinned })); } catch {} }
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
function showDevices(tab) {
  if (typeof tab !== 'string') tab = undefined;
  if (devices && !devices.isDestroyed()) { devices.show(); devices.focus(); if (tab) devices.webContents.send('devices:tab', tab); return; }
  devices = new BrowserWindow({
    width: 1000, height: 680, minWidth: 820, minHeight: 560, frame: true, autoHideMenuBar: true, backgroundColor: '#0A0D12', title: 'taskPercent – Geräte',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  devices.setMenu(null);
  // Mikrofon-Zugriff nur fuer dieses lokale Fenster erlauben
  devices.webContents.session.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  devices.loadFile(path.join(UI, 'devices.html'), tab ? { query: { tab } } : {});
  devices.on('closed', () => (devices = null));
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

// ---------- Peripherie-Tray-Icons (pro angepinntem Geraet ein Icon)
const periphTrays = new Map(); // id -> { tray, data, blink, on }
function syncPeriph(items) { // items: [{id, name, kind, bus, battery, icons:{normal, alt}}] nur fuer angepinnte
  const ids = new Set(items.map((i) => i.id));
  for (const [id, e] of periphTrays) if (!ids.has(id)) { clearInterval(e.blink); e.tray.destroy(); periphTrays.delete(id); }
  for (const it of items) {
    let e = periphTrays.get(it.id);
    if (!e) {
      const t = new Tray(img(it.icons.normal));
      t.on('click', () => showDevices('periph'));
      e = { tray: t, blink: null, on: false, data: it }; periphTrays.set(it.id, e);
    }
    e.data = it;
    e.tray.setImage(img(it.icons.normal));
    e.tray.setToolTip(`${it.name}${it.battery == null ? '' : ' – Akku ' + it.battery + '%'}`);
    const low = it.battery != null && it.battery <= 15;
    if (low && !e.blink) e.blink = setInterval(() => { e.on = !e.on; e.tray.setImage(img(e.on ? e.data.icons.alt : e.data.icons.normal)); }, 700);
    if (!low && e.blink) { clearInterval(e.blink); e.blink = null; e.on = false; }
  }
}
ipcMain.on('periph:report', (_e, items) => syncPeriph(items));
ipcMain.handle('periph:pinned', async () => ({ ok: true, data: settings.pinned }));
ipcMain.handle('periph:pin', async (_e, a) => {
  const set = new Set(settings.pinned); a.on ? set.add(String(a.id)) : set.delete(String(a.id));
  settings.pinned = [...set]; saveSettings();
  if (flyout && !flyout.isDestroyed()) flyout.webContents.send('periph:refresh');
  return { ok: true };
});

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
    { label: 'Geräte verwalten…', click: () => showDevices() },
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
  if (first.devices) showDevices();
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
ipcMain.on('devices:open', () => { flyout.hide(); showDevices(); });
ipcMain.on('devices:close', () => devices && devices.close());
// ---------- Audio-Geraete (Lautstaerke / Stummschaltung)
const guard = (fn) => async (_e, a) => { try { return { ok: true, data: await fn(a || {}) }; } catch (err) { return { ok: false, error: err.message }; } };
ipcMain.handle('audio:list', guard(() => native.audio.call('list')));
ipcMain.handle('audio:volume', guard((a) => native.audio.call('volume', { id: String(a.id), value: Number(a.value) })));
ipcMain.handle('audio:mute', guard((a) => native.audio.call('mute', { id: String(a.id), value: !!a.value })));
// ---------- Bluetooth + Admin-Helfer
ipcMain.handle('bt:list', guard(() => native.bluetooth.call('list')));
ipcMain.handle('bt:action', guard((a) => {
  if (!['connect', 'disconnect'].includes(a.action)) throw new Error('Aktion nicht erlaubt');
  return admin.request(a.action, String(a.id));
}));
ipcMain.handle('periph:list', guard(() => native.peripherals.call('list')));
ipcMain.handle('admin:status', guard(() => admin.status()));
ipcMain.handle('admin:setup', guard(() => admin.setup()));
ipcMain.handle('admin:remove', guard(() => admin.remove()));
app.on('before-quit', () => { native.audio.stop(); native.bluetooth.stop(); native.peripherals.stop(); });
ipcMain.on('app:quit', () => app.quit());
