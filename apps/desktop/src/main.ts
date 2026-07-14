import { app, BrowserWindow, ipcMain, protocol, net as electronNet } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { spawn, fork, ChildProcess } from 'node:child_process';
import { runInstallation } from './installer';
import { getFaceFusionDir, runFaceSwap } from '@meme-swap/faceswap-core';
import { gifToMp4, mp4ToGif } from '@meme-swap/video-processor';

// ── Verrou d'instance unique ──────────────────────────────────────────────────
// Empêche l'ouverture de plusieurs instances de l'application.
// Si une seconde instance est lancée, on ramène la fenêtre existante au premier plan.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Une autre instance tourne déjà : on quitte immédiatement celle-ci.
  app.quit();
}

// Enregistrer le protocole personnalisé 'app' comme privilégié avant le démarrage de l'application
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let mainWindow: BrowserWindow | null = null;

let mcpProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let faceswapProcess: ChildProcess | null = null;

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
  // On utilise donc `shell: true` + `next dev` en dev.
  // En mode packagé, Next.js est un export statique servi via protocole app://.
  const frontendDir = path.join(root, 'apps', 'frontend');

  if (app.isPackaged) {
    writeToLogFile("[Next.js] Mode packagé. Chargement direct de l'IHM statique via protocole app://\n");
    frontendStatus = 'ready';
    sendServerStatus();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL('app://index.html');
    }
  } else {
    // Mode dev : on utilise le shell système pour exécuter `next dev`
    writeToLogFile(`Démarrage du frontend Next.js sur le port ${frontendPort} (next dev, shell)...\n`);
    // `detached: true` place le process (et ses enfants next dev) dans son propre
    // groupe de processus, ce qui permet à stopServers() de tous les tuer via
    // process.kill(-pid, ...). Sans ça, les sous-process de next dev survivent.
    frontendProcess = spawn('pnpm', ['--filter', 'frontend', 'dev'], {
      cwd: root,
      shell: true,
      detached: true,
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

  if (faceswapProcess) {
    writeToLogFile("Arrêt du processus FaceFusion en cours...\n");
    faceswapProcess.kill('SIGTERM');
    faceswapProcess = null;
  }

  mcpStatus = 'stopped';
  frontendStatus = 'stopped';
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
  app.quit();
});

// Chemins de traitement pour le FaceSwap en local
const PROCESS_DIR = path.join(os.homedir(), '.meme-swap', 'process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');
const RESULTS_DIR = path.join(PROCESS_DIR, 'results');
const HISTORY_DIR = path.join(os.homedir(), '.meme-swap', 'source-history');

function ensureDirectories(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function pruneHistoryFiles(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  const files = fs.readdirSync(HISTORY_DIR);
  const fileInfos = files
    .map(name => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return { name, mtime: stats.mtimeMs };
      } catch (e) {
        return null;
      }
    })
    .filter((info): info is { name: string; mtime: number } => info !== null);

  fileInfos.sort((a, b) => b.mtime - a.mtime);

  if (fileInfos.length > 5) {
    const toDelete = fileInfos.slice(5);
    for (const info of toDelete) {
      try {
        fs.unlinkSync(path.join(HISTORY_DIR, info.name));
        writeToLogFile(`[History Pruning] Deleted old history file: ${info.name}\n`);
      } catch (e) {
        console.error(`Failed to delete old history file: ${info.name}`, e);
      }
    }
  }
}

function cleanupProcessDirs(): void {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('[IPC] Erreur de nettoyage du dossier temporaire:', error);
    }
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  if (fs.existsSync(RESULTS_DIR)) {
    try {
      fs.rmSync(RESULTS_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('[IPC] Erreur de nettoyage du dossier des résultats:', error);
    }
  }
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function generateFileName(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${extension}`;
}

// IPC : Récupérer le statut du serveur MCP
ipcMain.handle('get-mcp-status', async () => {
  return {
    active: mcpStatus === 'ready',
    port: mcpPort
  };
});

// IPC : Giphy Integration Handlers
ipcMain.handle('is-giphy-configured', async () => {
  const key = process.env.GIPHY_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
});

ipcMain.handle('search-giphy', async (event, options) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    throw new Error('GIPHY_API_KEY n\'est pas configurée dans le processus principal.');
  }
  const { query, limit = 8, offset = 0 } = options || {};
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Le serveur Giphy a répondu avec le statut ${response.status}`);
  }
  return await response.json();
});

ipcMain.handle('get-trending-giphy', async (event, options) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    throw new Error('GIPHY_API_KEY n\'est pas configurée dans le processus principal.');
  }
  const { limit = 8, offset = 0 } = options || {};
  const url = `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(key)}&limit=${limit}&offset=${offset}&rating=g`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Le serveur Giphy a répondu avec le statut ${response.status}`);
  }
  return await response.json();
});

// IPC : Récupérer l'historique des visages source
ipcMain.handle('get-source-history', async () => {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  pruneHistoryFiles();
  const files = fs.readdirSync(HISTORY_DIR);
  const fileInfos = files
    .map(name => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          url: `/api/source-history/${name}`,
          timestamp: stats.mtimeMs
        };
      } catch (e) {
        return null;
      }
    })
    .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

  fileInfos.sort((a, b) => b.timestamp - a.timestamp);
  return { success: true, history: fileInfos };
});

// IPC : Enregistrer un visage source dans l'historique
ipcMain.handle('save-source-face', async (event, options) => {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  writeToLogFile(`[History] Saving new source face to history...\n`);

  try {
    const ext = path.extname(options.name).toLowerCase() || '.jpg';
    const cleanExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const newFileName = `face-${timestamp}-${random}${cleanExt}`;
    const destPath = path.join(HISTORY_DIR, newFileName);

    if (options.path && typeof options.path === 'string') {
      fs.copyFileSync(options.path, destPath);
    } else if (options.data instanceof Uint8Array) {
      fs.writeFileSync(destPath, Buffer.from(options.data));
    } else {
      throw new Error('Format de fichier source non supporté');
    }

    const now = new Date();
    fs.utimesSync(destPath, now, now);

    pruneHistoryFiles();

    const files = fs.readdirSync(HISTORY_DIR);
    const fileInfos = files
      .map(name => {
        const filePath = path.join(HISTORY_DIR, name);
        try {
          const stats = fs.statSync(filePath);
          return {
            filename: name,
            url: `/api/source-history/${name}`,
            timestamp: stats.mtimeMs
          };
        } catch (e) {
          return null;
        }
      })
      .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

    fileInfos.sort((a, b) => b.timestamp - a.timestamp);
    return { success: true, savedFilename: newFileName, history: fileInfos };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    writeToLogFile(`❌ [History] Erreur de sauvegarde du visage : ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }
});

// IPC : Lancer l'exécution du FaceSwap
ipcMain.handle('run-faceswap', async (event, options) => {
  writeToLogFile("\n=== Lancement du FaceSwap par IPC Electron ===\n");
  
  try {
    ensureDirectories();
    cleanupProcessDirs();

    let sourcePath = '';
    if (typeof options.source === 'string') {
      if (options.source.startsWith('history:')) {
        const filename = options.source.replace('history:', '');
        sourcePath = path.join(HISTORY_DIR, filename);
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Le visage de l'historique ${filename} n'existe pas`);
        }
      } else {
        sourcePath = options.source;
      }
    } else if (options.source instanceof Uint8Array) {
      sourcePath = path.join(TEMP_DIR, options.sourceName || 'source.jpg');
      fs.writeFileSync(sourcePath, Buffer.from(options.source));
    } else {
      throw new Error('Format de fichier source non supporté');
    }

    let targetPath = '';
    if (typeof options.target === 'string') {
      targetPath = options.target;
    } else if (options.target instanceof Uint8Array) {
      targetPath = path.join(TEMP_DIR, options.targetName || 'target.gif');
      fs.writeFileSync(targetPath, Buffer.from(options.target));
    } else {
      throw new Error('Format de fichier cible non supporté');
    }

    writeToLogFile(`  Source: ${sourcePath}\n`);
    writeToLogFile(`  Target: ${targetPath}\n`);

    // 1. Convertir GIF en MP4 si nécessaire
    let targetForFaceswap = targetPath;
    const isTargetGif = (options.targetName && options.targetName.toLowerCase().endsWith('.gif')) || targetPath.toLowerCase().endsWith('.gif');

    if (isTargetGif) {
      writeToLogFile('[IPC] Conversion GIF → MP4...\n');
      const tempMp4Path = path.join(TEMP_DIR, generateFileName('mp4'));
      const gifToMp4Result = await gifToMp4({
        inputPath: targetPath,
        outputPath: tempMp4Path,
      });

      if (!gifToMp4Result.success) {
        throw new Error(`Conversion GIF→MP4 échouée: ${gifToMp4Result.error}`);
      }

      targetForFaceswap = tempMp4Path;
      writeToLogFile('[IPC] Conversion terminée\n');
    }

    // 2. Exécuter FaceFusion pour le face swap
    const outputMp4Path = path.join(RESULTS_DIR, generateFileName('mp4'));
    writeToLogFile('[IPC] Lancement de FaceFusion...\n');

    const faceswapResult = await runFaceSwap({
      sourcePath,
      targetPath: targetForFaceswap,
      outputPath: outputMp4Path,
      executionProviders: options.executionProviders,
      faceSelectorMode: options.faceSelectorMode,
      threadCount: options.threadCount,
      logLevel: options.logLevel,
      faceMaskBlend: options.faceMaskBlend,
      faceSwapperModel: options.faceSwapperModel,
      faceEnhancerModel: options.faceEnhancerModel,
      faceEnhancerBlend: options.faceEnhancerBlend,
      frameEnhancerModel: options.frameEnhancerModel,
      expressionRestorerModel: options.expressionRestorerModel,
      lipSyncerModel: options.lipSyncerModel,
      onProgress: (progress) => {
        event.sender.send('faceswap-progress', progress);
      },
      onProcessStart: (proc) => {
        faceswapProcess = proc;
      },
    });

    faceswapProcess = null;

    if (!faceswapResult.success) {
      throw new Error(`Face swap échoué: ${faceswapResult.error}`);
    }

    writeToLogFile('[IPC] Face swap terminé avec succès\n');

    // 3. Reconvertir MP4 en GIF pour l'affichage si la cible d'origine était un GIF
    let finalOutputPath = outputMp4Path;
    if (isTargetGif) {
      writeToLogFile('[IPC] Conversion MP4 → GIF...\n');
      const outputGifPath = path.join(RESULTS_DIR, generateFileName('gif'));
      
      const mp4ToGifResult = await mp4ToGif({
        inputPath: outputMp4Path,
        outputPath: outputGifPath,
        fps: 10,
        maxWidth: 320,
      });

      if (!mp4ToGifResult.success) {
        throw new Error(`Conversion MP4→GIF échouée: ${mp4ToGifResult.error}`);
      }

      finalOutputPath = outputGifPath;
      writeToLogFile('[IPC] Conversion terminée\n');
    }

    const resultFileName = path.basename(finalOutputPath);
    const resultUrl = `/api/results/${resultFileName}`;

    return {
      success: true,
      outputPath: resultUrl,
      message: 'Face swap réussi',
    };

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    writeToLogFile(`❌ Erreur pendant le FaceSwap par IPC : ${errorMsg}\n`);
    return {
      success: false,
      error: errorMsg,
    };
  }
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

  // ── Enregistrement du protocole custom 'app' ────────────────────────────────
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // 1. Servir les fichiers de résultat locaux
    if (pathname.startsWith('/api/results/')) {
      const fileName = pathname.replace('/api/results/', '');
      const resultsDir = path.join(os.homedir(), '.meme-swap', 'process', 'results');
      const filePath = path.join(resultsDir, fileName);
      return electronNet.fetch(pathToFileURL(filePath).toString());
    }

    // 1b. Servir les fichiers de l'historique des visages
    if (pathname.startsWith('/api/source-history/')) {
      const fileName = pathname.replace('/api/source-history/', '');
      const filePath = path.join(HISTORY_DIR, fileName);
      return electronNet.fetch(pathToFileURL(filePath).toString());
    }

    // 2. Servir l'application statique Next.js
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    
    // Le dossier out est copié dans les extraResources sous apps/frontend/out
    const staticDir = path.join(root, 'apps', 'frontend', 'out');
    const filePath = path.join(staticDir, pathname);
    return electronNet.fetch(pathToFileURL(filePath).toString());
  });

  createMainWindow();

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

app.on('window-all-closed', () => {
  app.quit();
});
