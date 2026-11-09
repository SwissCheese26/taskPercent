// Renderer: liest den Akku, zeichnet UI + Tray-Icons und meldet Zustand an den Main-Prozess.
const $ = (id) => document.getElementById(id);
const api = window.api || { // Fallback fuer Browser-Vorschau ohne Electron
  report() {}, getSettings: async () => ({ threshold: 15, autostart: false }), setSettings() {}, testWarning() {}, quit() {}, onSettings() {},
};
const params = new URLSearchParams(location.search);
const SEG = 20;
let settings = { threshold: 15, autostart: false };
let last = { percent: null, plugged: false, secs: null };

// ---- Ring aus 20 Segmenten (je 5 %)
const ring = $('ring');
const NS = 'http://www.w3.org/2000/svg';
const segs = [];
(function build() {
  const R = 98, gap = 3.2, span = 360 / SEG;
  for (let i = 0; i < SEG; i++) {
    const a0 = (-90 + i * span + gap) * Math.PI / 180, a1 = (-90 + (i + 1) * span - gap) * Math.PI / 180;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)}`);
    p.setAttribute('class', 'seg'); p.style.setProperty('--i', i);
    ring.appendChild(p); segs.push(p);
  }
  const core = document.createElementNS(NS, 'circle');
  core.setAttribute('r', 80); core.setAttribute('class', 'core'); ring.appendChild(core);
})();

function stateOf(percent, plugged) {
  if (plugged) return 'charging';
  if (percent <= settings.threshold) return 'critical';
  if (percent <= settings.threshold + 15) return 'warn';
  return 'normal';
}
const LABEL = { normal: 'Akkubetrieb', charging: 'Lädt', warn: 'Wird knapp', critical: 'Kritisch' };
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
  $('sub').textContent = st === 'critical' ? 'NETZTEIL ANSCHLIESSEN' : st === 'charging' ? 'WIRD GELADEN' : plugged ? 'AM NETZ' : 'VERBLEIBEND ' + fmt(secs).replace(' h', '');
  $('thr-val').textContent = $('st-thr').textContent = settings.threshold + '%';
  const lit = Math.ceil(percent / (100 / SEG));
  segs.forEach((s, i) => { s.classList.toggle('on', i < lit); s.classList.toggle('edge', i === lit - 1 && st === 'normal'); });

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

api.getSettings().then((s) => { settings = s; $('autostart').checked = s.autostart; startSource(); });
