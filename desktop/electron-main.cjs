/**
 * Lightweight Electron desktop wrapper for macOS (.dmg) and Windows (.exe).
 * Starts the local zero-knowledge sync server and opens the built app with
 * hardware-validated optional local Ollama model auto-pull.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { fork } = require('node:child_process');

let serverProc = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 390,
    minHeight: 620,
    title: 'Kavcy — Post-Quantum Personal AI Vault',
    backgroundColor: '#0b0b0d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://127.0.0.1:8787');
}

app.whenReady().then(() => {
  const serverPath = path.join(__dirname, '..', 'server', 'index.mjs');
  serverProc = fork(serverPath, [], {
    env: { ...process.env, PORT: '8787', NODE_ENV: 'production' },
  });

  setTimeout(createWindow, 600);
});

app.on('window-all-closed', () => {
  if (serverProc) serverProc.kill();
  if (process.platform !== 'darwin') app.quit();
});
