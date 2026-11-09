const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  report: (s) => ipcRenderer.send('battery:report', s),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.send('settings:set', s),
  onSettings: (cb) => ipcRenderer.on('settings:changed', (_e, s) => cb(s)),
  testWarning: () => ipcRenderer.send('toast:test'),
  closeToast: () => ipcRenderer.send('toast:close'),
  openDevices: () => ipcRenderer.send('devices:open'),
  closeDevices: () => ipcRenderer.send('devices:close'),
  quit: () => ipcRenderer.send('app:quit'),
});
