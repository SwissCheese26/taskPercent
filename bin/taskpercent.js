#!/usr/bin/env node
// CLI: taskpercent [start|show|test|quit] [--simulate 14|60c]
const { spawn } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
  console.log(`taskpercent - Akku-Prozente im Tray

  taskpercent              Startet die App im Tray
  taskpercent show         Öffnet das Flyout
  taskpercent devices      Öffnet die Geräteverwaltung
  taskpercent test         Zeigt die Warnung zum Ausprobieren
  taskpercent quit         Beendet die laufende Instanz
  --simulate <N>[c]        Akku simulieren (z.B. 14 oder 60c = 60 % am Netz)`);
  process.exit(0);
}
const cmd = { start: [], show: ['--show'], test: ['--test-warning'], devices: ['--devices'], quit: ['--quit'] }[args[0]];
const pass = cmd ? args.slice(1) : args;
const electron = require('electron');
spawn(electron, [path.join(__dirname, '..'), ...(cmd || []), ...pass], { detached: true, stdio: 'ignore' }).unref();
console.log('taskPercent läuft im Tray.');
