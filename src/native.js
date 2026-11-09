// Bruecke zu den PowerShell-Skripten in /native. Nur unter Windows aktiv.
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PsServer {
  constructor(script) { this.script = script; this.proc = null; this.pending = new Map(); this.rid = 0; }
  start() {
    if (process.platform !== 'win32') throw new Error('Nur unter Windows verfügbar');
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.script], { windowsHide: true });
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => {
      let m; try { m = JSON.parse(line); } catch { return; }
      const p = this.pending.get(m.rid); if (!p) return;
      this.pending.delete(m.rid); clearTimeout(p.t);
      m.ok ? p.resolve(m.data) : p.reject(new Error(m.error));
    });
    this.proc.on('exit', () => {
      this.proc = null;
      for (const p of this.pending.values()) { clearTimeout(p.t); p.reject(new Error('Hilfsprozess beendet')); }
      this.pending.clear();
    });
  }
  call(cmd, args = {}) {
    if (!this.proc) this.start();
    const rid = ++this.rid;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(rid); reject(new Error('Zeitüberschreitung')); }, 15000);
      this.pending.set(rid, { resolve, reject, t });
      this.proc.stdin.write(JSON.stringify({ rid, cmd, ...args }) + '\n');
    });
  }
  stop() { if (this.proc) this.proc.kill(); }
}

const audio = new PsServer(path.join(__dirname, '..', 'native', 'audio.ps1'));
const bluetooth = new PsServer(path.join(__dirname, '..', 'native', 'bluetooth.ps1'));
const peripherals = new PsServer(path.join(__dirname, '..', 'native', 'peripherals.ps1'));
module.exports = { audio, bluetooth, peripherals };
