const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER === 'true';

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    title: 'Apple Notes',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundColor: isMac ? '#00000000' : '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorCode, errorDescription);
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  buildMenu();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              {
                label: 'Check for Updates...',
                click: () => {
                  mainWindow?.webContents.send('action:check-updates');
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('action:new-note');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find in Notes',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow?.webContents.send('action:search');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Helper to download files with redirect support and progress reporting
function downloadFileWithProgress(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return downloadFileWithProgress(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total > 0 && onProgress) {
          const percent = Math.min(100, Math.round((received / total) * 100));
          onProgress(percent);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    });
    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch (_) {}
      reject(err);
    });
  });
}

// In-app seamless auto-updater for macOS and Windows
ipcMain.handle('updater:install-update', async (_event, downloadUrl) => {
  if (!downloadUrl) throw new Error('No download URL provided');

  if (process.platform === 'win32') {
    const tempExePath = path.join(os.tmpdir(), `Apple-Notes-Setup-${Date.now()}.exe`);
    try {
      await downloadFileWithProgress(downloadUrl, tempExePath, (percent) => {
        mainWindow?.webContents.send('updater:progress', percent);
      });
      mainWindow?.webContents.send('updater:progress', 100);

      const installer = spawn(tempExePath, [], {
        detached: true,
        stdio: 'ignore',
      });
      installer.unref();

      setTimeout(() => {
        app.quit();
      }, 400);
      return { success: true };
    } catch (err) {
      throw new Error(`Windows update failed: ${err.message}`);
    }
  }

  if (process.platform !== 'darwin') {
    throw new Error('Auto-update is currently supported on macOS and Windows');
  }

  const tempDmgPath = path.join(os.tmpdir(), `Apple-Notes-update-${Date.now()}.dmg`);
  const scriptPath = path.join(os.tmpdir(), `apply-apple-notes-update-${Date.now()}.sh`);

  try {
    // 1. Download DMG using reliable native https stream with progress reporting
    await downloadFileWithProgress(downloadUrl, tempDmgPath, (percent) => {
      mainWindow?.webContents.send('updater:progress', percent);
    });
    mainWindow?.webContents.send('updater:progress', 100);

    // 2. Mount DMG silently without opening a Finder window
    const attachOutput = execSync(`hdiutil attach -nobrowse -readonly "${tempDmgPath}"`).toString();
    const mountMatch = attachOutput.match(/\/Volumes\/[^\n\r]+/);
    if (!mountMatch) {
      throw new Error('Could not find DMG mount volume');
    }
    const mountPoint = mountMatch[0].trim();

    // 3. Locate the new .app inside the mounted DMG
    const files = fs.readdirSync(mountPoint);
    const appName = files.find((f) => f.endsWith('.app'));
    if (!appName) {
      execSync(`hdiutil detach "${mountPoint}" -force`);
      throw new Error('No .app found inside the DMG image');
    }
    const sourceApp = path.join(mountPoint, appName);

    // 4. Determine current installed app path (or default to /Applications)
    let targetApp = process.execPath.replace(/\/Contents\/MacOS\/.*$/, '');
    if (!targetApp.endsWith('.app') || !fs.existsSync(targetApp)) {
      targetApp = '/Applications/Apple Notes.app';
    }

    // 5. Generate bash script to swap the app and restart after current PID exits
    const scriptContent = `#!/bin/bash
OLD_PID=${process.pid}
SOURCE_APP="${sourceApp}"
TARGET_APP="${targetApp}"
MOUNT_POINT="${mountPoint}"
DMG_PATH="${tempDmgPath}"

# Wait for old Electron app process to fully exit
while kill -0 "$OLD_PID" 2>/dev/null; do
  sleep 0.2
done

# Replace installed application bundle
rm -rf "$TARGET_APP"
cp -R "$SOURCE_APP" "$TARGET_APP"

# Detach DMG and cleanup
hdiutil detach "$MOUNT_POINT" -force >/dev/null 2>&1
rm -f "$DMG_PATH"
rm -f "$0"

# Remove quarantine attribute so Gatekeeper allows immediate launch
xattr -rd com.apple.quarantine "$TARGET_APP" >/dev/null 2>&1 || true

# Relaunch updated application
open -n -a "$TARGET_APP"
`;

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

    // 6. Spawn update script detached and quit current app
    const updateProcess = spawn('/bin/bash', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    updateProcess.unref();

    setTimeout(() => {
      app.quit();
    }, 300);

    return { success: true };
  } catch (err) {
    throw new Error(`macOS update failed: ${err.message}`);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
