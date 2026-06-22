import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { spawn, fork, ChildProcess } from 'node:child_process';
import { runInstallation } from './installer';
import { getFaceFusionDir } from '@meme-swap/faceswap-core';

// ── Verrou d'instance unique ──────────────────────────────────────────────────
// Empêche l'ouverture de plusieurs instances de l'application.
// Si une seconde instance est lancée, on ramène la fenêtre existante au premier plan.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Une autre instance tourne déjà : on quitte immédiatement celle-ci.
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let mcpProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;

// Ces ports sont résolus dynamiquement au démarrage (voir findFreePort)
let frontendPort: string = process.env.MEME_SWAP_PORT || process.env.PORT || '3010';
let mcpPort: string = process.env.MCP_PORT || '10001';

/**
 * Teste si un port TCP est libre sur 127.0.0.1.
 * Résout avec `true` si le port est disponible, `false` s'il est occupé.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Retourne le premier port libre à partir de `preferred`.
 * Essaie jusqu'à `preferred + maxTries - 1`.
 */
async function findFreePort(preferred: number, maxTries = 20): Promise<number> {
  for (let i = 0; i < maxTries; i++) {
    const port = preferred + i;
    if (await isPortFree(port)) {
      return port;
    }
    // writeToLogFile n'est pas encore disponible ici (défini plus bas),
    // on utilise console.log comme fallback de log bas niveau.
    console.log(`[findFreePort] Port ${port} occupé, essai du port ${port + 1}...`);
  }
  throw new Error(`Aucun port libre trouvé entre ${preferred} et ${preferred + maxTries - 1}`);
}

/**
 * Résout le répertoire racine du projet selon le contexte d'exécution :
 * - En mode packagé (app .dmg), les resources sont dans `process.resourcesPath`
 * - En mode développement, on remonte depuis __dirname pour trouver pnpm-workspace.yaml
 */
function resolveRoot(): string {
  // En mode packagé, Electron expose process.resourcesPath
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  // En mode dev, remonter jusqu'au workspace pnpm
  let currentDir = __dirname;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd();
}

const root = resolveRoot();

let isQuitting = false;

// Server statuses
let mcpStatus: 'stopped' | 'starting' | 'ready' | 'error' = 'stopped';
let frontendStatus: 'stopped' | 'starting' | 'ready' | 'error' = 'stopped';

// Stockage des logs dans ~/.meme-swap/logs/ (cohérent avec les autres données de l'app)
const logsDir = path.join(os.homedir(), '.meme-swap', 'logs');
const logFilePath = path.join(logsDir, 'desktop.log');

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
  let called = false;
  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      if (called) return;
      called = true;
      clearInterval(interval);
      callback();
    });
    req.on('error', () => {
      // Port non ouvert, on réessaie au prochain tick
    });
    req.end();
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
async function startServers() {
  writeToLogFile("\n=== Lancement des serveurs d'arrière-plan ===\n");
  mcpStatus = 'starting';
  frontendStatus = 'starting';
  sendServerStatus();

  // Résolution dynamique des ports pour éviter EADDRINUSE
  try {
    const resolvedMcp = await findFreePort(parseInt(mcpPort));
    if (resolvedMcp !== parseInt(mcpPort)) {
      writeToLogFile(`⚠️  Port MCP ${mcpPort} occupé → utilisation du port ${resolvedMcp}\n`);
    }
    mcpPort = resolvedMcp.toString();

    const resolvedFrontend = await findFreePort(parseInt(frontendPort));
    if (resolvedFrontend !== parseInt(frontendPort)) {
      writeToLogFile(`⚠️  Port Frontend ${frontendPort} occupé → utilisation du port ${resolvedFrontend}\n`);
    }
    frontendPort = resolvedFrontend.toString();
  } catch (err) {
    writeToLogFile(`❌ Impossible de trouver des ports libres : ${err}\n`);
    mcpStatus = 'error';
    frontendStatus = 'error';
    sendServerStatus();
    return;
  }

  writeToLogFile(`✅ Ports résolus → MCP: ${mcpPort}, Frontend: ${frontendPort}\n`);

  // En mode packagé ou développement, process.execPath pointe vers le binaire Electron lui-même.
  // Pour l'utiliser comme runtime Node.js (sans lancer l'UI Electron),
  // on injecte ELECTRON_RUN_AS_NODE=1 dans l'environnement des processus enfants.
  const nodeBin = process.execPath;
  const childEnvBase: Record<string, string> = {
    ...process.env as Record<string, string>,
    ELECTRON_RUN_AS_NODE: '1',
  };

  // 1. Démarrer le serveur MCP
  writeToLogFile(`Démarrage du serveur MCP sur le port ${mcpPort}...\n`);
  const mcpPath = app.isPackaged
    ? path.join(root, 'apps', 'mcp-server', 'bundle', 'index.js')
    : path.join(root, 'apps', 'mcp-server', 'build', 'index.js');
  
  if (app.isPackaged) {
    mcpProcess = fork(mcpPath, [], {
      cwd: path.join(root, 'apps', 'mcp-server', 'bundle'),
      env: { ...childEnvBase, PORT: mcpPort },
      silent: true
    });
  } else {
    mcpProcess = spawn(nodeBin, [mcpPath], {
      cwd: path.join(root, 'apps', 'mcp-server'),
      env: { ...childEnvBase, PORT: mcpPort }
    });
  }

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

  // 2. Démarrer le frontend Next.js
  // En mode dev : le `.bin/next` est un script shell — on ne peut pas le passer
  // directement au binaire Node embarqué d'Electron (qui attend du JS).
  // On utilise donc `shell: true` + `next dev` en dev, et le binaire Node
  // embarqué + le vrai fichier .js de next en mode packagé.
  const frontendDir = path.join(root, 'apps', 'frontend');

  if (app.isPackaged) {
    // Mode production : next start via le binaire Node embarqué d'Electron.
    // Dans le build standalone, on lance directement le server.js généré par Next.js.
    const standaloneServerJs = path.join(root, 'apps', 'frontend', 'standalone', 'apps', 'frontend', 'server.js');

    writeToLogFile(`Démarrage du frontend Next.js sur le port ${frontendPort} (Next.js standalone, packaged)...\n`);
    writeToLogFile(`  → Next.js JS path: ${standaloneServerJs}\n`);
    frontendProcess = fork(standaloneServerJs, [], {
      cwd: path.join(root, 'apps', 'frontend', 'standalone', 'apps', 'frontend'),
      env: { ...childEnvBase, PORT: frontendPort, MCP_PORT: mcpPort },
      silent: true
    });
  } else {
    // Mode dev : on utilise le shell système pour exécuter `next dev`
    // (le script .bin/next est un script bash, pas du JS)
    writeToLogFile(`Démarrage du frontend Next.js sur le port ${frontendPort} (next dev, shell)...\n`);
    frontendProcess = spawn('pnpm', ['--filter', 'frontend', 'dev'], {
      cwd: root,
      shell: true,
      env: { ...process.env, PORT: frontendPort, MCP_PORT: mcpPort }
    });
  }

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
    statusLabel = `Meme Swap : Prêt (MCP :${mcpPort})`;
    statusIndicator = '🟢';
  }

  // Ne pas afficher de texte à côté de l'icône dans la barre de menu macOS
  tray.setTitle('');

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

// Ramener la fenêtre existante au premier plan si une seconde instance est lancée
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Cycle de vie de l'application Electron
app.whenReady().then(() => {
  // Si nous n'avons pas obtenu le verrou, quit() a déjà été appelé plus haut.
  // On garde un guard ici par sécurité.
  if (!gotTheLock) return;

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
