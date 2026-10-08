/**
 * desktop.js
 * TextHuman — Standalone Native Desktop Window Launcher
 * 
 * Launches TextHuman in dedicated frameless window mode using Windows Edge/Chrome
 * without bulky Electron dependencies, zero memory overhead, and instant launch speed.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;

function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(APP_URL, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackgroundServer() {
  const serverScript = path.join(__dirname, 'server.js');
  const child = spawn(process.execPath, [serverScript], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname,
    windowsHide: true
  });
  child.unref();
  console.log(`[TextHuman] Background local daemon started (PID: ${child.pid}).`);
}

async function waitForServer(maxRetries = 25) {
  for (let i = 0; i < maxRetries; i++) {
    const alive = await isServerRunning();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

function findBrowserBinary() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const candidatePaths = [
    // Microsoft Edge (Present on 100% of modern Windows systems)
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),

    // Google Chrome
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),

    // Brave Browser
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function launchDesktopApp() {
  console.log('[TextHuman] Initializing TextHuman Desktop Edition...');

  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('[TextHuman] Booting local backend server...');
    startBackgroundServer();
    const ready = await waitForServer();
    if (!ready) {
      console.error('[TextHuman] Could not start local server on port 3000.');
      process.exit(1);
    }
  }

  const browserExe = findBrowserBinary();
  const windowArgs = [
    `--app=${APP_URL}`,
    '--window-size=1380,890',
    '--window-position=80,40',
    '--disable-features=Translate',
    '--disable-extensions'
  ];

  if (browserExe) {
    console.log(`[TextHuman] Launching native window via: ${path.basename(browserExe)}`);
    const appProcess = spawn(browserExe, windowArgs, {
      detached: true,
      stdio: 'ignore'
    });
    appProcess.unref();
    console.log('[TextHuman] Desktop application launched successfully.');
  } else {
    // Fallback to default browser
    console.log('[TextHuman] Opening TextHuman in default browser...');
    spawn('cmd.exe', ['/c', 'start', APP_URL], { detached: true, stdio: 'ignore' }).unref();
  }
}

launchDesktopApp().catch(err => {
  console.error('[TextHuman Desktop Error]:', err);
});
