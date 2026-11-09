// Einmalige Admin-Einrichtung (geplante Aufgabe mit hoechsten Rechten) und Anfragen an den Helfer.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const TASK = 'taskPercentHelper';
const base = () => path.join(process.env.ProgramData || 'C:\\ProgramData', 'taskPercent');
const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { windowsHide: true }, (err, so, se) => res({ code: err ? (err.code || 1) : 0, out: so, err: se })));
const q = (s) => String(s).replace(/'/g, "''");

async function status() {
  if (process.platform !== 'win32') return false;
  const r = await run('schtasks.exe', ['/query', '/tn', TASK]);
  return r.code === 0 && fs.existsSync(path.join(base(), 'helper.ps1'));
}

// Zeigt EINMAL die UAC-Abfrage und richtet dann alles ein.
function elevated(extra) {
  const script = path.join(__dirname, '..', 'native', 'setup-admin.ps1');
  const helper = path.join(__dirname, '..', 'native', 'helper.ps1');
  const user = `${process.env.USERDOMAIN}\\${os.userInfo().username}`;
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `"${script}"`, '-User', `"${user}"`, '-Source', `"${helper}"`, ...extra];
  const cmd = `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList ${args.map((a) => `'${q(a)}'`).join(',')}`;
  return run('powershell.exe', ['-NoProfile', '-Command', cmd]);
}
async function setup() {
  if (process.platform !== 'win32') throw new Error('Nur unter Windows verfügbar');
  await elevated([]);
  if (!(await status())) throw new Error('Einrichtung abgebrochen oder fehlgeschlagen');
}
async function remove() { await elevated(['-Remove']); if (await status()) throw new Error('Entfernen abgebrochen'); }

// Anfrage an den erhoehten Helfer (ohne neue UAC-Abfrage)
async function request(action, instanceId) {
  if (!(await status())) throw new Error('Admin-Helfer nicht eingerichtet');
  const id = crypto.randomUUID();
  const reqFile = path.join(base(), 'requests', id + '.json');
  const resFile = path.join(base(), 'results', id + '.json');
  fs.writeFileSync(reqFile, JSON.stringify({ action, instanceId }));
  const r = await run('schtasks.exe', ['/run', '/tn', TASK]);
  if (r.code !== 0) throw new Error('Helfer konnte nicht gestartet werden');
  for (let i = 0; i < 60; i++) {
    await new Promise((s) => setTimeout(s, 500));
    if (fs.existsSync(resFile)) {
      const out = JSON.parse(fs.readFileSync(resFile, 'utf8').replace(/^\uFEFF/, ''));
      fs.rmSync(resFile, { force: true });
      if (!out.ok) throw new Error(out.error || 'Fehlgeschlagen');
      return true;
    }
  }
  throw new Error('Zeitüberschreitung beim Admin-Helfer');
}
module.exports = { status, setup, remove, request };
