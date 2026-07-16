import { app, BrowserWindow, ipcMain, protocol, net as electronNet, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { spawn, fork, ChildProcess } from 'node:child_process';
import { runInstallation } from './installer';
import { checkDiskSpace } from '@meme-swap/installer-core';
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
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;

let mcpProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let faceswapProcess: ChildProcess | null = null;

// Ces ports sont résolus dynamiquement au démarrage (voir findFreePort)
let frontendPort: string = process.env.MEME_SWAP_PORT || process.env.PORT || '3010';
let mcpPort: string = process.env.MCP_PORT || '3001';

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
    // on utilise console.info comme fallback de log bas niveau.
    console.info(`[findFreePort] Port ${port} occupé, essai du port ${port + 1}...`);
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
      frontend: frontendStatus,
    });
  }
}

// ── Vérification de mise à jour (check + notify, pas d'auto-update silencieux) ─
// L'app n'est pas signée/notarisée (voir build.mac dans package.json et le
// README), et Squirrel.Mac exige un binaire signé pour valider l'app en
// cours d'exécution : un vrai auto-update silencieux est donc hors de
// portée pour l'instant. On se contente de vérifier périodiquement la
// dernière release GitHub et de notifier l'IHM si une version plus récente
// existe ; l'utilisateur clique alors pour ouvrir la page de release dans
// son navigateur (voir open-external-url ci-dessous).
const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/Tlahey/meme-swap/releases/latest';
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Compare deux versions "major.minor.patch" (sans préfixe 'v').
 * Retourne un entier positif si `a` > `b`, négatif si `a` < `b`, 0 si égales.
 * Volontairement minimaliste (pas de dépendance `semver`) : les tags de ce
 * repo suivent strictement X.Y.Z (voir `git tag -l`), pas de pré-release/build
 * metadata à gérer ici.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

/**
 * Interroge l'API GitHub pour la dernière release publique et notifie l'IHM
 * (event `update-available`) si elle est plus récente que la version
 * actuelle. Best-effort : toute erreur (hors ligne, API GitHub down/rate
 * limited, JSON malformé) est simplement journalisée — cette vérification ne
 * doit jamais bloquer le démarrage ni afficher d'erreur à l'utilisateur.
 */
async function checkForUpdate(): Promise<void> {
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      writeToLogFile(`[UpdateCheck] Réponse GitHub non-OK : ${response.status}\n`);
      return;
    }

    const data = await response.json();
    const tagName = typeof data?.tag_name === 'string' ? data.tag_name : null;
    const releaseUrl = typeof data?.html_url === 'string' ? data.html_url : null;
    if (!tagName || !releaseUrl) {
      writeToLogFile('[UpdateCheck] Réponse GitHub malformée (tag_name/html_url manquant)\n');
      return;
    }

    const remoteVersion = tagName.replace(/^v/, '');
    const currentVersion = app.getVersion();

    if (compareVersions(remoteVersion, currentVersion) > 0) {
      writeToLogFile(
        `[UpdateCheck] Nouvelle version disponible : ${remoteVersion} (actuelle : ${currentVersion})\n`,
      );
      mainWindow?.webContents.send('update-available', { version: remoteVersion, url: releaseUrl });
    }
  } catch (error) {
    writeToLogFile(`[UpdateCheck] Échec de la vérification de mise à jour : ${error}\n`);
  }
}

/**
 * Attend que le port spécifié soit actif avant d'exécuter le callback.
 * Retourne une fonction d'annulation : à utiliser si le processus qu'on
 * attendait a échoué à démarrer entre-temps (sinon ce polling risque de
 * détecter un *autre* serveur qui occuperait le même port et de charger son
 * contenu par erreur — voir l'appelant dans startServers()).
 */
function waitForPort(port: number, callback: () => void): () => void {
  let called = false;
  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}/`, () => {
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
  return () => clearInterval(interval);
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
      writeToLogFile(
        `⚠️  Port Frontend ${frontendPort} occupé → utilisation du port ${resolvedFrontend}\n`,
      );
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
    ...(process.env as Record<string, string>),
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
      silent: true,
    });
  } else {
    mcpProcess = spawn(nodeBin, [mcpPath], {
      cwd: path.join(root, 'apps', 'mcp-server'),
      env: { ...childEnvBase, PORT: mcpPort },
    });
  }

  mcpProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    writeToLogFile(`[MCP Server] ${text}`);
    if (
      text.includes('started') ||
      text.includes('Server started') ||
      text.includes('MCP Server started')
    ) {
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

  if (app.isPackaged) {
    writeToLogFile(
      "[Next.js] Mode packagé. Chargement direct de l'IHM statique via protocole app://\n",
    );
    frontendStatus = 'ready';
    sendServerStatus();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL('app://index.html');
    }
  } else {
    // Mode dev : on utilise le shell système pour exécuter `next dev`.
    // MAX_PORT_RETRIES borne le nombre de tentatives si le port choisi par
    // findFreePort() est en fait pris par un autre processus qui a démarré
    // entre le check et le spawn ci-dessous (race inévitable en check-then-act,
    // déjà observée en pratique avec un autre process next dev concurrent).
    const MAX_PORT_RETRIES = 5;

    const spawnFrontendDev = (port: number, attempt: number) => {
      frontendPort = port.toString();
      writeToLogFile(`Démarrage du frontend Next.js sur le port ${port} (next dev, shell)...\n`);

      // `detached: true` place le process (et ses enfants next dev) dans son propre
      // groupe de processus, ce qui permet à stopServers() de tous les tuer via
      // process.kill(-pid, ...). Sans ça, les sous-process de next dev survivent.
      frontendProcess = spawn('pnpm', ['--filter', 'frontend', 'dev'], {
        cwd: root,
        shell: true,
        detached: true,
        env: { ...process.env, PORT: port.toString(), MCP_PORT: mcpPort },
      });

      let sawAddrInUse = false;

      frontendProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        writeToLogFile(`[Next.js] ${text}`);
        if (
          text.includes('Ready in') ||
          text.includes('ready - started') ||
          text.includes('Local:')
        ) {
          // Nous gardons aussi la détection par logs en secours
          if (frontendStatus !== 'ready') {
            frontendStatus = 'ready';
            sendServerStatus();
          }
        }
      });

      frontendProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        writeToLogFile(`[Next.js ERROR] ${text}`);
        if (text.includes('EADDRINUSE')) {
          sawAddrInUse = true;
        }
      });

      // 3. Surveiller l'ouverture du port Next.js pour charger l'IHM. On garde
      // la fonction d'annulation : si next dev échoue à démarrer sur ce port
      // (EADDRINUSE, cf. plus bas), il faut arrêter ce polling avant qu'il ne
      // détecte par erreur un *autre* serveur déjà présent sur le même port
      // et charge son contenu dans la fenêtre (déjà arrivé avec un process
      // orphelin d'une autre session laissé en tâche de fond).
      const cancelWaitForPort = waitForPort(port, () => {
        writeToLogFile(
          `[Next.js] Le port ${port} est actif. Chargement de l'IHM dans Electron.\n`,
        );
        frontendStatus = 'ready';
        sendServerStatus();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${port}`);
        }
      });

      frontendProcess.on('close', (code) => {
        writeToLogFile(`[Next.js] Processus terminé avec le code ${code}\n`);
        cancelWaitForPort();

        if (sawAddrInUse && attempt < MAX_PORT_RETRIES) {
          writeToLogFile(
            `⚠️  Port ${port} occupé par un autre processus, nouvelle tentative sur un autre port...\n`,
          );
          void findFreePort(port + 1).then((nextPort) => {
            spawnFrontendDev(nextPort, attempt + 1);
          });
          return;
        }

        if (code !== 0 && code !== null) {
          frontendStatus = 'error';
        } else {
          frontendStatus = 'stopped';
        }
        sendServerStatus();
      });
    };

    spawnFrontendDev(parseInt(frontendPort), 0);
  }
}

/**
 * Arrête tous les serveurs d'arrière-plan proprement
 */
function stopServers() {
  writeToLogFile("\n=== Arrêt des serveurs d'arrière-plan ===\n");

  if (mcpProcess) {
    writeToLogFile('Arrêt du serveur MCP...\n');
    mcpProcess.kill('SIGTERM');
    mcpProcess = null;
  }

  if (frontendProcess) {
    writeToLogFile('Arrêt du frontend Next.js...\n');
    if (frontendProcess.pid) {
      try {
        process.kill(-frontendProcess.pid, 'SIGTERM');
      } catch {
        frontendProcess.kill('SIGTERM');
      }
    }
    frontendProcess = null;
  }

  if (faceswapProcess) {
    writeToLogFile('Arrêt du processus FaceFusion en cours...\n');
    faceswapProcess.kill('SIGTERM');
    faceswapProcess = null;
  }

  mcpStatus = 'stopped';
  frontendStatus = 'stopped';
}

// ── Arrêt propre sur signal (Ctrl+C / kill en dev) ─────────────────────────────
// app.on('before-quit') ne couvre que les sorties initiées par Electron
// lui-même (fenêtre fermée, app.quit(), Cmd+Q). Si le process reçoit
// directement SIGINT/SIGTERM — ce qui arrive en dev à chaque Ctrl+C du
// terminal lançant `tsc && electron .` — ce hook n'est jamais déclenché et
// les enfants détachés (next dev + son next-server, mcp-server) survivent en
// tâche de fond, allant ensuite squatter les ports au prochain lancement.
// SIGKILL reste bien sûr impossible à intercepter, mais SIGINT/SIGTERM
// couvrent tous les arrêts volontaires normaux.
let shuttingDown = false;
function shutdownAndExit(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  writeToLogFile(`\n[Process] Signal ${signal} reçu, arrêt propre des serveurs...\n`);
  stopServers();
  process.exit(0);
}
process.on('SIGINT', () => shutdownAndExit('SIGINT'));
process.on('SIGTERM', () => shutdownAndExit('SIGTERM'));

// IPC : Écouteur pour démarrer le processus d'installation
ipcMain.on('start-setup', async () => {
  writeToLogFile("Démarrage de l'assistant d'installation graphique...\n");

  const success = await runInstallation(
    (progressData) => {
      mainWindow?.webContents.send('setup-progress', progressData);
    },
    (logText) => {
      mainWindow?.webContents.send('setup-log', logText);
      writeToLogFile(logText);
    },
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

// IPC : Vérification préalable (espace disque) affichée avant de démarrer l'installation
ipcMain.handle('get-setup-preflight', async () => {
  return checkDiskSpace();
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

/**
 * Nombre de résultats conservés dans RESULTS_DIR pour l'historique de
 * re-téléchargement. Les fichiers résultats sont petits (un GIF de sortie
 * pèse typiquement quelques centaines de Ko), donc une limite plus généreuse
 * que celle de l'historique des visages source (5) reste peu coûteuse en
 * espace disque tout en étant plus utile pour parcourir des essais passés.
 */
const RESULTS_HISTORY_LIMIT = 20;

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
    .map((name) => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return { name, mtime: stats.mtimeMs };
      } catch {
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

/**
 * Cap safety net proportionné pour TEMP_DIR. Le nettoyage par requête
 * ci-dessous purge déjà TEMP_DIR sans condition avant chaque run, mais cette
 * purge avale silencieusement ses erreurs (voir le try/catch), et elle ne se
 * déclenche que si un *autre* swap a lieu ensuite — un run planté ou
 * abandonné sans requête suivante laisse ses fichiers pour toujours. Ce n'est
 * pas un timer d'arrière-plan (rien d'autre dans ce code base n'en a un) :
 * juste un contrôle de taille à chaque appel de cleanupProcessDirs() *et* au
 * démarrage de l'app (voir app.whenReady ci-dessous, pour couvrir le cas où
 * l'utilisateur ne relance jamais de swap après un crash), qui force une
 * purge complète et logue bruyamment si TEMP_DIR devient anormalement gros,
 * pour qu'une suppression silencieusement en échec devienne visible plutôt
 * qu'invisible.
 *
 * Même seuil et même raisonnement que côté web
 * (apps/frontend/app/api/faceswap/route.ts) : l'empreinte temp d'un seul run
 * (source, MP4 converti, dossier de travail frames de FaceFusion, MP4 de
 * sortie avant reconversion) se situe typiquement entre quelques dizaines et
 * quelques centaines de Mo. 2 Go est environ un ordre de grandeur au-dessus
 * d'un run lourd isolé : le franchir signifie soit plusieurs runs abandonnés
 * accumulés, soit une purge en échec silencieux — pas un usage normal à un
 * seul run.
 */
const TEMP_DIR_SAFETY_CAP_BYTES = 2 * 1024 * 1024 * 1024;

function getDirSizeBytes(dirPath: string): number {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let total = 0;
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        total += getDirSizeBytes(entryPath);
      } else {
        total += fs.statSync(entryPath).size;
      }
    } catch {
      // Fichier supprimé entre le readdir et le stat : on ignore et continue.
    }
  }
  return total;
}

function enforceTempDirSafetyNet(): void {
  if (!fs.existsSync(TEMP_DIR)) return;

  const sizeBytes = getDirSizeBytes(TEMP_DIR);
  if (sizeBytes <= TEMP_DIR_SAFETY_CAP_BYTES) return;

  const message =
    `[Cleanup] SAFETY NET: ${TEMP_DIR} has reached ${(sizeBytes / (1024 * 1024)).toFixed(0)} MB, ` +
    `above the ${(TEMP_DIR_SAFETY_CAP_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB cap for normal single-run usage. ` +
    'Forcing a full purge — this usually means a previous cleanup silently failed, or several runs were abandoned without a follow-up swap.\n';
  console.error(message);
  writeToLogFile(`❌ ${message}`);

  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error(`[Cleanup] SAFETY NET purge also failed for ${TEMP_DIR}:`, error);
  }
}

/**
 * Supprime les fichiers temporaires au début de chaque run. RESULTS_DIR
 * n'est volontairement plus purgé ici : les résultats y persistent d'un run
 * à l'autre pour alimenter l'historique de re-téléchargement (voir
 * pruneResultsFiles, appelée après chaque run réussi).
 */
function cleanupProcessDirs(): void {
  enforceTempDirSafetyNet();

  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('[IPC] Erreur de nettoyage du dossier temporaire:', error);
    }
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Conserve seulement les RESULTS_HISTORY_LIMIT résultats les plus récents
 * dans RESULTS_DIR, pour permettre leur re-téléchargement ultérieur sans
 * ré-exécuter le swap (même logique que pruneHistoryFiles côté source-history).
 */
function pruneResultsFiles(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const files = fs.readdirSync(RESULTS_DIR);
  const fileInfos = files
    .map((name) => {
      const filePath = path.join(RESULTS_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return { name, mtime: stats.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((info): info is { name: string; mtime: number } => info !== null);

  fileInfos.sort((a, b) => b.mtime - a.mtime);

  if (fileInfos.length > RESULTS_HISTORY_LIMIT) {
    const toDelete = fileInfos.slice(RESULTS_HISTORY_LIMIT);
    for (const info of toDelete) {
      try {
        fs.unlinkSync(path.join(RESULTS_DIR, info.name));
        writeToLogFile(`[Results Pruning] Deleted old result file: ${info.name}\n`);
      } catch (e) {
        console.error(`Failed to delete old result file: ${info.name}`, e);
      }
    }
  }
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
    port: mcpPort,
  };
});

// IPC : Ouvrir une URL dans le navigateur système (utilisé par la bannière de
// mise à jour pour envoyer l'utilisateur vers la page de release GitHub).
// Volontairement scopé à ce seul usage plutôt qu'un setWindowOpenHandler
// global, pour ne pas élargir la surface d'attaque inutilement. L'URL vient
// de la réponse de l'API GitHub donc elle est de confiance, mais on la
// valide quand même par défense en profondeur.
ipcMain.handle('open-external-url', async (event, url: string) => {
  if (typeof url !== 'string' || !/^https:\/\/github\.com\//.test(url)) {
    writeToLogFile(`[open-external-url] URL rejetée (hors github.com) : ${url}\n`);
    return;
  }
  await shell.openExternal(url);
});

// IPC : Giphy Integration Handlers
ipcMain.handle('is-giphy-configured', async () => {
  const key = process.env.GIPHY_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
});

ipcMain.handle('search-giphy', async (event, options) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    throw new Error("GIPHY_API_KEY n'est pas configurée dans le processus principal.");
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
    throw new Error("GIPHY_API_KEY n'est pas configurée dans le processus principal.");
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
    .map((name) => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          url: `/api/source-history/${name}`,
          timestamp: stats.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

  fileInfos.sort((a, b) => b.timestamp - a.timestamp);
  return { success: true, history: fileInfos };
});

// IPC : Récupérer l'historique des résultats générés
ipcMain.handle('get-results-history', async () => {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  pruneResultsFiles();
  const files = fs.readdirSync(RESULTS_DIR);
  const fileInfos = files
    .map((name) => {
      const filePath = path.join(RESULTS_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          url: `/api/results/${name}`,
          timestamp: stats.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

  fileInfos.sort((a, b) => b.timestamp - a.timestamp);
  return { success: true, history: fileInfos };
});

// IPC: Delete a result from history
ipcMain.handle('delete-result', async (event, filename: string) => {
  try {
    if (
      typeof filename !== 'string' ||
      !filename ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..')
    ) {
      throw new Error('Nom de fichier invalide');
    }

    const filePath = path.join(RESULTS_DIR, filename);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(RESULTS_DIR))) {
      throw new Error('Accès non autorisé');
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    writeToLogFile(`❌ [History] Erreur de suppression du résultat : ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }
});

// IPC: Clear the entire results history
ipcMain.handle('clear-results-history', async () => {
  try {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }
    const files = fs.readdirSync(RESULTS_DIR);
    for (const name of files) {
      try {
        fs.unlinkSync(path.join(RESULTS_DIR, name));
      } catch (error) {
        writeToLogFile(`❌ [History] Erreur de suppression du fichier ${name} : ${error}\n`);
      }
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    writeToLogFile(`❌ [History] Erreur de vidage de l'historique des résultats : ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }
});

// IPC: Delete a source face from history
ipcMain.handle('delete-source-face', async (event, filename: string) => {
  try {
    if (
      typeof filename !== 'string' ||
      !filename ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..')
    ) {
      throw new Error('Nom de fichier invalide');
    }

    const filePath = path.join(HISTORY_DIR, filename);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(HISTORY_DIR))) {
      throw new Error('Accès non autorisé');
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    writeToLogFile(`❌ [History] Erreur de suppression du visage : ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }
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
      .map((name) => {
        const filePath = path.join(HISTORY_DIR, name);
        try {
          const stats = fs.statSync(filePath);
          return {
            filename: name,
            url: `/api/source-history/${name}`,
            timestamp: stats.mtimeMs,
          };
        } catch {
          return null;
        }
      })
      .filter(
        (info): info is { filename: string; url: string; timestamp: number } => info !== null,
      );

    fileInfos.sort((a, b) => b.timestamp - a.timestamp);
    return { success: true, savedFilename: newFileName, history: fileInfos };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
    writeToLogFile(`❌ [History] Erreur de sauvegarde du visage : ${errorMsg}\n`);
    return { success: false, error: errorMsg };
  }
});

// IPC : Lancer l'exécution du FaceSwap
ipcMain.handle('run-faceswap', async (event, options) => {
  writeToLogFile('\n=== Lancement du FaceSwap par IPC Electron ===\n');

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
    const isTargetGif =
      (options.targetName && options.targetName.toLowerCase().endsWith('.gif')) ||
      targetPath.toLowerCase().endsWith('.gif');

    if (isTargetGif) {
      writeToLogFile('[IPC] Conversion GIF → MP4...\n');
      const tempMp4Path = path.join(TEMP_DIR, generateFileName('mp4'));
      const gifToMp4Result = await gifToMp4({
        inputPath: targetPath,
        outputPath: tempMp4Path,
      });

      if (!gifToMp4Result.success) {
        throw Object.assign(new Error(`GIF→MP4 conversion failed: ${gifToMp4Result.error}`), {
          errorCode: gifToMp4Result.errorCode,
        });
      }

      targetForFaceswap = tempMp4Path;
      writeToLogFile('[IPC] Conversion terminée\n');
    }

    // 2. Exécuter FaceFusion pour le face swap
    // Si la cible d'origine est un GIF, ce MP4 n'est qu'un intermédiaire (il
    // sera reconverti en GIF à l'étape 3 et n'est jamais servi tel quel) :
    // il vit alors dans TEMP_DIR. Sinon (cible déjà MP4), c'est lui le
    // résultat final servi via /api/results/, donc il doit rester dans
    // RESULTS_DIR pour être visible par le protocole app:// et l'historique.
    const outputMp4Path = path.join(isTargetGif ? TEMP_DIR : RESULTS_DIR, generateFileName('mp4'));
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
      throw Object.assign(new Error(`Face swap failed: ${faceswapResult.error}`), {
        errorCode: faceswapResult.errorCode,
      });
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
        throw Object.assign(new Error(`MP4→GIF conversion failed: ${mp4ToGifResult.error}`), {
          errorCode: mp4ToGifResult.errorCode,
        });
      }

      finalOutputPath = outputGifPath;
      writeToLogFile('[IPC] Conversion terminée\n');
    }

    pruneResultsFiles();

    const resultFileName = path.basename(finalOutputPath);
    const resultUrl = `/api/results/${resultFileName}`;

    return {
      success: true,
      outputPath: resultUrl,
      message: 'Face swap réussi',
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    const errorCode = (error as { errorCode?: 'missing-install' | 'broken-install' } | undefined)
      ?.errorCode;
    writeToLogFile(`❌ Erreur pendant le FaceSwap par IPC : ${errorMsg}\n`);
    return {
      success: false,
      error: errorMsg,
      errorCode,
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

  // Vérifie TEMP_DIR dès le démarrage de l'app : le nettoyage par requête ne
  // se déclenche que si un swap suivant a lieu, donc un run planté juste
  // avant que l'utilisateur ne quitte l'app laisserait sinon ses fichiers
  // pour toujours (voir enforceTempDirSafetyNet ci-dessus).
  enforceTempDirSafetyNet();

  // Créer un fichier icône vide temporaire pour éviter une erreur de chargement
  const placeholderPath = path.join(__dirname, 'icon_placeholder.png');
  if (!fs.existsSync(placeholderPath) || fs.statSync(placeholderPath).size === 0) {
    const base64Png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
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
    writeToLogFile('FaceFusion est déjà installé. Démarrage des serveurs en arrière-plan.\n');
    mainWindow?.loadFile(path.join(__dirname, 'loading.html'));
    startServers();
  } else {
    writeToLogFile(
      "FaceFusion n'est pas détecté ou setup forcé. Lancement de l'assistant d'installation.\n",
    );
    mainWindow?.loadFile(path.join(__dirname, 'setup.html'));
  }

  // Vérification de mise à jour en arrière-plan : ne bloque jamais le
  // démarrage (pas d'await), lancée une fois puis répétée périodiquement
  // pour les sessions longues (voir checkForUpdate ci-dessus).
  //
  // Le premier appel est différé de quelques secondes : webContents.send()
  // ne met pas en file d'attente les messages envoyés avant que le renderer
  // n'ait un listener actif sur le canal (contrairement à sendServerStatus,
  // qui a son propre handshake de re-envoi via l'IPC 'loading-ready' —
  // voir plus bas). Sans ce délai, un fetch GitHub qui répond vite pourrait
  // envoyer 'update-available' avant que UpdateBanner (React) ne soit monté
  // et abonné, et le message serait silencieusement perdu jusqu'à la
  // prochaine vérification périodique.
  setTimeout(() => {
    void checkForUpdate();
  }, 15_000);
  updateCheckInterval = setInterval(() => {
    void checkForUpdate();
  }, UPDATE_CHECK_INTERVAL_MS);
});

// Nettoyer tous les serveurs avant de quitter
app.on('before-quit', () => {
  stopServers();
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
