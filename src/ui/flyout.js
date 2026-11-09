// Renderer: liest den Akku, zeichnet UI + Tray-Icons und meldet Zustand an den Main-Prozess.
const $ = (id) => document.getElementById(id);
const api = window.api || { // Fallback fuer Browser-Vorschau ohne Electron
  report() {}, getSettings: async () => ({ threshold: 15, autostart: false }), setSettings() {}, testWarning() {}, quit() {}, onSettings() {},
};
const params = new URLSearchParams(location.search);
let settings = { threshold: 15, autostart: false };
let last = { percent: null, plugged: false, secs: null };

const prog = $('prog'), CIRC = 2 * Math.PI * 94;

function stateOf(percent, plugged) {
  if (plugged) return 'charging';
  if (percent <= settings.threshold) return 'critical';
  if (percent <= settings.threshold + 15) return 'warn';
  return 'normal';
}
const LABEL = { normal: 'Akkubetrieb', charging: 'Lädt', warn: 'Akku wird knapp', critical: 'Akku schwach' };
function fmt(secs) {
  if (!isFinite(secs) || secs <= 0) return '—';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')} h`;
}

function render() {
  const { percent, plugged, secs } = last;
  if (percent == null) return;
  const st = stateOf(percent, plugged);
  document.body.dataset.state = st;
  $('pct').textContent = percent;
  $('chip').textContent = LABEL[st];
  $('st-state').textContent = plugged ? (percent >= 100 ? 'Voll' : 'Netzteil') : 'Akku';
  $('st-time').textContent = plugged ? '—' : fmt(secs);
  $('sub').textContent = st === 'critical' ? 'Netzteil anschließen' : st === 'charging' ? 'Wird geladen' : plugged ? 'Am Netz' : secs && isFinite(secs) ? fmt(secs) + ' verbleibend' : '\u00a0';
  $('thr-val').textContent = settings.threshold + '%';
  prog.style.strokeDashoffset = CIRC * (1 - percent / 100);

  api.report({
    percent, plugged, secs: isFinite(secs) ? secs : null, state: st,
    icons: { normal: drawTrayIcon(percent, st, false), alt: drawTrayIcon(percent, st, true) },
  });
}

// ---- Batterie-Quelle: Simulation (?sim=14 / ?sim=60c) oder echte Battery-API
async function startSource() {
  const sim = params.get('sim');
  if (sim) {
    const m = /^(\d{1,3})(c?)$/.exec(sim);
    const p = Math.min(100, +m[1]);
    last = { percent: p, plugged: m[2] === 'c', secs: p * 180 };
    return render();
  }
  if (!navigator.getBattery) { last = { percent: null }; $('chip').textContent = 'Kein Akku'; return; }
  const b = await navigator.getBattery();
  const read = () => { last = { percent: Math.round(b.level * 100), plugged: b.charging, secs: b.dischargingTime }; render(); };
  ['levelchange', 'chargingchange', 'dischargingtimechange'].forEach((e) => b.addEventListener(e, read));
  setInterval(read, 30000);
  read();
}

// ---- Einstellungen
function save() { api.setSettings(settings); render(); }
$('thr-minus').onclick = () => { settings.threshold = Math.max(5, settings.threshold - 5); save(); };
$('thr-plus').onclick = () => { settings.threshold = Math.min(30, settings.threshold + 5); save(); };
$('autostart').onchange = (e) => { settings.autostart = e.target.checked; save(); };
$('manage').onclick = () => api.openDevices();
$('test').onclick = () => api.testWarning();
$('quit').onclick = () => api.quit();
api.onSettings((s) => { settings = s; $('autostart').checked = s.autostart; render(); });

// ---- Angepinnte Peripherie: Akkustand pollen, Tray-Icons melden
async function pollPeriph() {
  if (!api.periphPinned || params.get('sim')) return;
  const p = await api.periphPinned(); if (!p.ok || !p.data.length) return api.periphReport([]);
  const r = await api.periphList(); if (!r.ok) return;
  const items = r.data.filter((d) => p.data.includes(d.Id)).map((d) => ({
    id: d.Id, name: d.Name, kind: d.Kind, bus: d.Bus, battery: d.Battery, wired: !!d.Wired,
    icons: { normal: drawDeviceTrayIcon(d.Kind, d.Battery, false, d.Wired), alt: drawDeviceTrayIcon(d.Kind, d.Battery, true, d.Wired) },
  }));
  api.periphReport(items);
}
if (api.onPeriphRefresh) api.onPeriphRefresh(pollPeriph);
setInterval(pollPeriph, 60000); setTimeout(pollPeriph, 4000);

if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { render(); pollPeriph(); });

api.getSettings().then((s) => { settings = s; $('autostart').checked = s.autostart; startSource(); });
