import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { getFaceFusionDir, getWorkspaceRoot } from '@meme-swap/faceswap-core';

/**
 * Helper pour exécuter une commande système de manière asynchrone
 */
function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (text: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    onLog(`\n[EXEC] ${cmd} ${args.join(' ')}\n`);
    
    // On utilise shell: true pour prendre en compte les alias et variables d'environnement utilisateur (comme Homebrew)
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}` }
    });

    proc.stdout.on('data', (data: Buffer) => {
      onLog(data.toString());
    });

    proc.stderr.on('data', (data: Buffer) => {
      onLog(data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        onLog(`\n[ERROR] La commande a échoué avec le code de retour ${code}\n`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      onLog(`\n[ERROR] Impossible de démarrer la commande : ${err.message}\n`);
      resolve(false);
    });
  });
}

/**
 * Lance le script d'installation séquentiel
 */
export async function runInstallation(
  onProgress: (data: { step: string; status: 'active' | 'completed' | 'failed'; percent: number }) => void,
  onLog: (text: string) => void
): Promise<boolean> {
  const root = getWorkspaceRoot();
  onLog(`Démarrage de l'installation dans : ${root}\n`);

  // ---- Étape 1 : Vérification système (Homebrew, Python, FFmpeg) ----
  onProgress({ step: 'system-checks', status: 'active', percent: 5 });
  onLog("=== ÉTAPE 1 : Vérification de Homebrew, Python et FFmpeg ===\n");

  // 1.1 Python
  onLog("Recherche de python3...\n");
  const hasPython = await runCmd('python3', ['--version'], root, onLog);
  if (!hasPython) {
    onLog("[ERROR] Python 3 n'est pas installé sur ce Mac. Veuillez l'installer avant de continuer.\n");
    onProgress({ step: 'system-checks', status: 'failed', percent: 10 });
    return false;
  }

  // 1.2 Homebrew (requis : c'est lui qui installe et maintient FFmpeg à jour)
  onLog("Recherche de Homebrew...\n");
  const hasBrew = await runCmd('which', ['brew'], root, onLog);
  if (!hasBrew) {
    onLog("[ERROR] Homebrew est requis mais introuvable. Installez-le depuis https://brew.sh puis relancez la configuration.\n");
    onProgress({ step: 'system-checks', status: 'failed', percent: 10 });
    return false;
  }

  // 1.3 FFmpeg via Homebrew (jamais copié : toujours résolu depuis Homebrew au runtime,
  // pour rester synchronisé avec ses librairies partagées après un `brew upgrade`)
  onLog("Recherche de ffmpeg (Homebrew)...\n");
  const hasFfmpeg = await runCmd('brew', ['list', 'ffmpeg'], root, () => {});
  if (!hasFfmpeg) {
    onLog("FFmpeg non installé. Installation via Homebrew (brew install ffmpeg)...\n");
    const installedFfmpeg = await runCmd('brew', ['install', 'ffmpeg'], root, onLog);
    if (!installedFfmpeg) {
      onLog("[ERROR] Échec de l'installation de FFmpeg via Homebrew.\n");
      onProgress({ step: 'system-checks', status: 'failed', percent: 15 });
      return false;
    }
  } else {
    onLog("[OK] FFmpeg déjà installé via Homebrew.\n");
  }

  onLog("[OK] Vérifications système réussies.\n");
  onProgress({ step: 'system-checks', status: 'completed', percent: 20 });


  // ---- Étape 2 : Cloner FaceFusion ----
  onProgress({ step: 'clone-repo', status: 'active', percent: 25 });
  onLog("\n=== ÉTAPE 2 : Clonage du dépôt FaceFusion ===\n");
  
  const ffDir = getFaceFusionDir();
  const vendorDir = path.dirname(ffDir);

  if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
  }

  if (fs.existsSync(path.join(ffDir, 'facefusion.py'))) {
    onLog("[OK] FaceFusion est déjà cloné.\n");
  } else {
    onLog("Clonage de FaceFusion depuis GitHub...\n");
    const cloned = await runCmd('git', ['clone', 'https://github.com/facefusion/facefusion.git', 'facefusion'], vendorDir, onLog);
    if (!cloned) {
      onLog("[ERROR] Impossible de cloner le dépôt FaceFusion.\n");
      onProgress({ step: 'clone-repo', status: 'failed', percent: 40 });
      return false;
    }
    onLog("[OK] FaceFusion cloné avec succès.\n");
  }
  onProgress({ step: 'clone-repo', status: 'completed', percent: 40 });


  // ---- Étape 3 : Création du Venv ----
  onProgress({ step: 'setup-venv', status: 'active', percent: 45 });
  onLog("\n=== ÉTAPE 3 : Configuration de l'environnement virtuel venv ===\n");
  
  const venvDir = path.join(ffDir, 'venv');
  if (fs.existsSync(venvDir)) {
    onLog("[OK] L'environnement virtuel venv existe déjà.\n");
  } else {
    onLog("Création de l'environnement venv (python3 -m venv venv)...\n");
    const venvCreated = await runCmd('python3', ['-m', 'venv', 'venv'], ffDir, onLog);
    if (!venvCreated) {
      onLog("[ERROR] Impossible de créer l'environnement virtuel venv.\n");
      onProgress({ step: 'setup-venv', status: 'failed', percent: 55 });
      return false;
    }
  }

  // Mise à jour de pip
  onLog("Mise à jour de pip dans le venv...\n");
  const pipUpdated = await runCmd('./venv/bin/python', ['-m', 'pip', 'install', '--upgrade', 'pip'], ffDir, onLog);
  if (!pipUpdated) {
    onLog("[WARNING] Échec de la mise à jour de pip. On continue malgré tout.\n");
  }

  onLog("[OK] Configuration venv réussie.\n");
  onProgress({ step: 'setup-venv', status: 'completed', percent: 60 });


  // ---- Étape 4 : Installation des dépendances FaceFusion (CoreML) ----
  onProgress({ step: 'install-deps', status: 'active', percent: 65 });
  onLog("\n=== ÉTAPE 4 : Installation des dépendances Python (CoreML) ===\n");

  onLog("Installation des packages du requirements.txt (cela peut prendre quelques minutes)...\n");
  const reqsInstalled = await runCmd('./venv/bin/pip', ['install', '-r', 'requirements.txt'], ffDir, onLog);
  if (!reqsInstalled) {
    onLog("[ERROR] Échec de l'installation des dépendances du requirements.txt\n");
    onProgress({ step: 'install-deps', status: 'failed', percent: 75 });
    return false;
  }

  onLog("Installation de onnxruntime-silicon pour le support CoreML GPU...\n");
  const onnxSiliconInstalled = await runCmd('./venv/bin/pip', ['install', 'onnxruntime-silicon'], ffDir, onLog);
  if (!onnxSiliconInstalled) {
    onLog("[ERROR] Échec de l'installation de onnxruntime-silicon\n");
    onProgress({ step: 'install-deps', status: 'failed', percent: 80 });
    return false;
  }

  onLog("[OK] Dépendances Python installées avec succès.\n");
  onProgress({ step: 'install-deps', status: 'completed', percent: 85 });


  // ---- Étape 5 : Compilation du Monorepo ----
  onProgress({ step: 'build-monorepo', status: 'active', percent: 90 });
  onLog("\n=== ÉTAPE 5 : Compilation des packages du Monorepo ===\n");

  onLog("Build du monorepo (pnpm run build)...\n");
  const monorepoBuilt = await runCmd('pnpm', ['run', 'build'], root, onLog);
  if (!monorepoBuilt) {
    onLog("[ERROR] Échec de la compilation du monorepo.\n");
    onProgress({ step: 'build-monorepo', status: 'failed', percent: 95 });
    return false;
  }

  onLog("[OK] Compilation du monorepo réussie.\n");
  onProgress({ step: 'build-monorepo', status: 'completed', percent: 100 });

  return true;
}
