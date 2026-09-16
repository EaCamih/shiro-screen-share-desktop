import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { registerDeepLinkProtocol, parseDeepLinkUrl } from './protocol';
import { AudioCaptureEngine } from './audioEngine';
import { setupIpcHandlers } from './ipcHandlers';

// Set Windows Application ID for Taskbar Icon & Grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.shiro.screenshare');
}

// Low Latency GPU Hardware Acceleration & Video Delivery Flags
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Silence Chromium internal C++ log spam (wgc_capture_session.cc, etc.)
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('disable-features', 'WindowsGraphicsCapture,WGCWindowCapturer,WGCDisplayCapturer');

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pendingDeepLink: any = null;
let appShouldQuit = false;

const audioEngine = new AudioCaptureEngine();

// Single Instance Lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[Main] Single instance lock failed. Quitting secondary instance.');
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    handleArgvDeepLink(argv);
  });
}

// Register Protocol Client
registerDeepLinkProtocol();

function handleArgvDeepLink(argv: string[]): void {
  const deepLinkArg = argv.find((arg) => arg.startsWith('shiro://'));
  if (deepLinkArg) {
    const params = parseDeepLinkUrl(deepLinkArg);
    if (params) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('deep-link', params);
        mainWindow.show();
        mainWindow.focus();
      } else {
        pendingDeepLink = params;
      }
    }
  }
}

function getIconPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(__dirname, '..', 'renderer', 'icon.ico'),
    path.join(__dirname, '..', '..', 'icon.ico'),
    path.join(process.cwd(), 'icon.ico')
  ];
  for (const candidate of candidates) {
    if (require('fs').existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(__dirname, '..', '..', 'icon.ico');
}

function createWindow(): void {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0e14',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  setupIpcHandlers(mainWindow, audioEngine);

  const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.loadFile(htmlPath);

  mainWindow.on('ready-to-show', () => {
    if (pendingDeepLink && mainWindow) {
      mainWindow.webContents.send('deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  mainWindow.on('close', (event) => {
    if (!appShouldQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  createTray(iconPath);
}

function createTray(iconPath: string): void {
  if (tray || process.platform !== 'win32') return;

  try {
    const icon = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Shiro Screen Share',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Sair',
        click: () => {
          appShouldQuit = true;
          audioEngine.stopCapture();
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Shiro Screen Share — Desktop Capturer');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('[Tray] Could not create system tray:', err);
  }
}

app.whenReady().then(() => {
  createWindow();
  handleArgvDeepLink(process.argv);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  audioEngine.stopCapture();
});
