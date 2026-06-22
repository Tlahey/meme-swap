import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import { runInstallation } from './installer';
import { getFaceFusionDir, getWorkspaceRoot } from '@meme-swap/faceswap-core';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let mcpProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;

const frontendPort = process.env.MEME_SWAP_PORT || process.env.PORT || '3010';
const mcpPort = process.env.MCP_PORT || '3001';

const root = getWorkspaceRoot();
const logsDir = path.join(root, 'apps', 'desktop', 'logs');
const logFilePath = path.join(logsDir, 'desktop.log');

let isQuitting = false;

// Server statuses
let mcpStatus: 'stopped' | 'starting' | 'ready' | 'error' = 'stopped';
let frontendStatus: 'stopped' | 'starting' | 'ready' | 'error' = 'stopped';

// Assurer l'existence du dossier de logs
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Réinitialiser le fichier de logs à chaque démarrage
fs.writeFileSync(logFilePath, `=== Nouvelle session Meme Swap : ${new Date().toISOString()} ===\n`);

/**
 * Écrit un message dans le fichier log local et l'envoie à la fenêtre principale si ouverte
 */
function writeToLogFile(text: string) {
  const timestamp = new Date().toISOString();
  const formattedText = text.endsWith('\n') ? text : `${text}\n`;
  const logMsg = `[${timestamp}] ${formattedText}`;
  fs.appendFileSync(logFilePath, logMsg);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-log', logMsg);
  }
}

/**
 * Envoie le statut en temps réel des serveurs à l'IHM
 */
function sendServerStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status', {
      mcp: mcpStatus,
      frontend: frontendStatus
    });
  }
  
  const overallState = (mcpStatus === 'ready' && frontendStatus === 'ready') ? 'ready' : 'starting';
  updateTrayMenu(overallState);
}

/**
 * Attend que le port spécifié soit actif avant d'exécuter le callback
 */
function waitForPort(port: number, callback: () => void) {
  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      clearInterval(interval);
      callback();
    });
    req.on('error', () => {
      // Port non ouvert, on réessaie au prochain tick
    });
  }, 500);
}

/**
 * Vérifie si FaceFusion et son venv sont déjà installés
 */
function isInstalled(): boolean {
  const ffDir = getFaceFusionDir();
  const pythonPath = path.join(ffDir, 'venv', 'bin', 'python');
  const python3Path = path.join(ffDir, 'venv', 'bin', 'python3');
  return fs.existsSync(pythonPath) || fs.existsSync(python3Path);
}

/**
 * Crée la fenêtre principale unifiée
 */
function createMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    resizable: true,
    title: 'Meme Swap',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
  });

  mainWindow.on('close', (event) => {
    // Si on ne quitte pas explicitement l'application, on masque la fenêtre
    // pour garder les serveurs actifs en arrière-plan.
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Démarre les processus d'arrière-plan (Next.js & MCP) et attend que le port soit prêt
 */
function startServers() {
  writeToLogFile("\n=== Lancement des serveurs d'arrière-plan ===\n");
  mcpStatus = 'starting';
  frontendStatus = 'starting';
  sendServerStatus();

  // 1. Démarrer le serveur MCP
  writeToLogFile(`Démarrage du serveur MCP sur le port ${mcpPort}...\n`);
  const mcpPath = path.join(root, 'apps', 'mcp-server', 'build', 'index.js');
  mcpProcess = spawn('node', [mcpPath], {
    cwd: path.join(root, 'apps', 'mcp-server'),
    env: { ...process.env, PORT: mcpPort }
  });

  mcpProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    writeToLogFile(`[MCP Server] ${text}`);
    if (text.includes('started') || text.includes('Server started') || text.includes('MCP Server started')) {
      mcpStatus = 'ready';
      sendServerStatus();
    }
  });

  mcpProcess.stderr?.on('data', (data) => {
    writeToLogFile(`[MCP Server ERROR] ${data.toString()}`);
  });

  mcpProcess.on('close', (code) => {
    writeToLogFile(`[MCP Server] Processus terminé avec le code ${code}\n`);
    if (code !== 0 && code !== null) {
      mcpStatus = 'error';
    } else {
      mcpStatus = 'stopped';
    }
    sendServerStatus();
  });

  // 2. Démarrer le frontend Next.js (sans passer de paramètres conflictuels en CLI)
  writeToLogFile(`Démarrage du frontend Next.js sur le port ${frontendPort} (pnpm --filter frontend dev)...\n`);
  frontendProcess = spawn('pnpm', ['--filter', 'frontend', 'dev'], {
    cwd: root,
    shell: true,
    env: { ...process.env, PORT: frontendPort, MCP_PORT: mcpPort }
  });

  frontendProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    writeToLogFile(`[Next.js] ${text}`);
    if (text.includes('Ready in') || text.includes('ready - started') || text.includes('Local:')) {
      // Nous gardons aussi la détection par logs en secours
      if (frontendStatus !== 'ready') {
        frontendStatus = 'ready';
        sendServerStatus();
      }
    }
  });

  frontendProcess.stderr?.on('data', (data) => {
    writeToLogFile(`[Next.js ERROR] ${data.toString()}`);
  });

  frontendProcess.on('close', (code) => {
    writeToLogFile(`[Next.js] Processus terminé avec le code ${code}\n`);
    if (code !== 0 && code !== null) {
      frontendStatus = 'error';
    } else {
      frontendStatus = 'stopped';
    }
    sendServerStatus();
  });

  // 3. Surveiller l'ouverture du port Next.js pour charger l'IHM
  waitForPort(parseInt(frontendPort), () => {
    writeToLogFile(`[Next.js] Le port ${frontendPort} est actif. Chargement de l'IHM dans Electron.\n`);
    frontendStatus = 'ready';
    sendServerStatus();
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://localhost:${frontendPort}`);
    }
  });
}

/**
 * Arrête tous les serveurs d'arrière-plan proprement
 */
function stopServers() {
  writeToLogFile("\n=== Arrêt des serveurs d'arrière-plan ===\n");
  
  if (mcpProcess) {
    writeToLogFile("Arrêt du serveur MCP...\n");
    mcpProcess.kill('SIGTERM');
    mcpProcess = null;
  }
  
  if (frontendProcess) {
    writeToLogFile("Arrêt du frontend Next.js...\n");
    if (frontendProcess.pid) {
      try {
        process.kill(-frontendProcess.pid, 'SIGTERM');
      } catch (e) {
        frontendProcess.kill('SIGTERM');
      }
    }
    frontendProcess = null;
  }
  
  mcpStatus = 'stopped';
  frontendStatus = 'stopped';
}

/**
 * Configure et met à jour le menu de la barre des tâches (Tray)
 */
function initTray() {
  const iconName = process.platform === 'darwin' ? 'assets/tray_iconTemplate.png' : 'icon_placeholder.png';
  tray = new Tray(path.join(__dirname, iconName));
  updateTrayMenu('starting');
}

function updateTrayMenu(state: 'starting' | 'ready') {
  if (!tray) return;

  let statusLabel = 'Meme Swap : Démarrage...';
  let statusIndicator = '🟠';

  if (state === 'ready') {
    statusLabel = `Meme Swap : Prêt (Port ${frontendPort})`;
    statusIndicator = '🟢';
    tray.setTitle('Meme Swap');
  } else {
    tray.setTitle('Meme Swap...');
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `${statusIndicator} ${statusLabel}`, enabled: false },
    { type: 'separator' },
    {
      label: "Ouvrir l'application",
      click: () => {
        createMainWindow();
        if (frontendStatus === 'ready') {
          mainWindow?.loadURL(`http://localhost:${frontendPort}`);
        } else {
          mainWindow?.loadFile(path.join(__dirname, 'loading.html'));
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        stopServers();
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Superviseur Meme Swap');
}

// IPC : Écouteur pour démarrer le processus d'installation
ipcMain.on('start-setup', async (event) => {
  writeToLogFile("Démarrage de l'assistant d'installation graphique...\n");
  
  const success = await runInstallation(
    (progressData) => {
      mainWindow?.webContents.send('setup-progress', progressData);
    },
    (logText) => {
      mainWindow?.webContents.send('setup-log', logText);
      writeToLogFile(logText);
    }
  );

  mainWindow?.webContents.send('setup-finished', success);

  if (success) {
    // Si l'installation réussit, on attend 2.5 secondes puis on bascule sur l'IHM de chargement
    setTimeout(() => {
      mainWindow?.loadFile(path.join(__dirname, 'loading.html'));
      startServers();
    }, 2500);
  }
});

// IPC : Écouteurs pour l'écran de chargement
ipcMain.on('loading-ready', (event) => {
  sendServerStatus();
  if (fs.existsSync(logFilePath)) {
    const history = fs.readFileSync(logFilePath, 'utf8');
    event.reply('server-log', history);
  }
});

ipcMain.on('quit-app', () => {
  stopServers();
  isQuitting = true;
  app.quit();
});

// Cycle de vie de l'application Electron
app.whenReady().then(() => {
  // Créer un fichier icône vide temporaire pour éviter une erreur de chargement
  const placeholderPath = path.join(__dirname, 'icon_placeholder.png');
  if (!fs.existsSync(placeholderPath) || fs.statSync(placeholderPath).size === 0) {
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(placeholderPath, Buffer.from(base64Png, 'base64'));
  }

  createMainWindow();
  initTray();

  if (isInstalled() && !process.argv.includes('--force-setup')) {
    writeToLogFile("FaceFusion est déjà installé. Démarrage des serveurs en arrière-plan.\n");
    mainWindow?.loadFile(path.join(__dirname, 'loading.html'));
    startServers();
  } else {
    writeToLogFile("FaceFusion n'est pas détecté ou setup forcé. Lancement de l'assistant d'installation.\n");
    mainWindow?.loadFile(path.join(__dirname, 'setup.html'));
  }
});

// Nettoyer tous les serveurs avant de quitter
app.on('before-quit', () => {
  stopServers();
});
