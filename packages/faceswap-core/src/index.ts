import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Options pour exécuter FaceFusion
 */
export interface FaceswapOptions {
  /** Chemin vers l'image source (visage à transférer) */
  sourcePath: string;
  /** Chemin vers la vidéo cible (GIF converti en MP4) */
  targetPath: string;
  /** Chemin de sortie pour le résultat */
  outputPath: string;
  /** Fournisseurs d'exécution (coreml, cpu, cuda) */
  executionProviders?: ('coreml' | 'cpu' | 'cuda')[];
  /** Mode du sélecteur de face: 'many', 'one', 'reference' */
  faceSelectorMode?: string;
  /** Nombre de threads pour l'exécution */
  threadCount?: number;
  /** Niveau de log (debug, info, warning, error) */
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
  /** Garder les fichiers temporaires */
  keepTemp?: boolean;
  /** Blend ratio for the face mask */
  faceMaskBlend?: number;
  /** Face swapper model to use */
  faceSwapperModel?: string;
  /** Face enhancer model to use (if true, face_enhancer processor is added) */
  faceEnhancerModel?: string;
  /** Blend ratio for the face enhancer (maps to --face-enhancer-blend, 0-100) */
  faceEnhancerBlend?: number;
  /** Frame enhancer model to use (if true, frame_enhancer processor is added) */
  frameEnhancerModel?: string;
  /** Lip syncer model to use (if true, lip_syncer processor is added) */
  lipSyncerModel?: string;
  /** Expression restorer model to use (if true, expression_restorer processor is added) */
  expressionRestorerModel?: string;
  /** Callback triggered when a progress update is parsed from stdout/stderr */
  onProgress?: (progress: { step: string; percent: number }) => void;
  /** Callback triggered with the spawned child process, so the caller can track/kill it (e.g. on app quit) */
  onProcessStart?: (process: ChildProcess) => void;
}

/**
 * Closed set of environment/install problems the pipeline can classify, as
 * opposed to an ordinary swap failure (bad media, FaceFusion crashing on a
 * specific frame, etc). Threaded through FaceswapResult and mirrored by
 * video-processor's ConversionResult (same string values, kept as an
 * independent literal type there since the two packages don't depend on each
 * other) so callers — the SSE `done` event in
 * apps/frontend/app/api/faceswap/route.ts and the desktop `run-faceswap` IPC
 * response — can tell "FaceFusion/Python/ffmpeg is missing or broken" apart
 * from a regular failure without re-parsing error message strings.
 */
export type FaceswapErrorCode = 'missing-install' | 'broken-install';

/**
 * Résultat d'une opération de face swap
 */
export interface FaceswapResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  errorCode?: FaceswapErrorCode;
}

/**
 * Trouve le répertoire racine du projet (workspace) contenant pnpm-workspace.yaml
 */
export function getWorkspaceRoot(): string {
  let currentDir = __dirname;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback alternatif
  let fallbackDir = process.cwd();
  while (fallbackDir !== path.parse(fallbackDir).root) {
    if (fs.existsSync(path.join(fallbackDir, 'pnpm-workspace.yaml'))) {
      return fallbackDir;
    }
    fallbackDir = path.dirname(fallbackDir);
  }
  return process.cwd();
}

/**
 * Trouve le répertoire d'installation de FaceFusion.
 * Utilise toujours le dossier global utilisateur (~/.meme-swap/facefusion).
 */
export function getFaceFusionDir(): string {
  return path.join(/*turbopackIgnore: true*/ os.homedir(), '.meme-swap', 'facefusion');
}

/**
 * Chemin vers le binaire Python de l'environnement virtuel FaceFusion
 */
function getPythonPath(): string {
  const ffDir = getFaceFusionDir();
  // Utiliser python3.11 si disponible (plus stable pour FaceFusion)
  const python311Path = path.join(ffDir, 'venv', 'bin', 'python3.11');
  if (fs.existsSync(python311Path)) {
    return python311Path;
  }
  const python3Path = path.join(ffDir, 'venv', 'bin', 'python3');
  if (fs.existsSync(python3Path)) {
    return python3Path;
  }
  return path.join(ffDir, 'venv', 'bin', 'python');
}

/**
 * Chemin vers le script principal de FaceFusion
 */
function getScriptPath(): string {
  const ffDir = getFaceFusionDir();
  return path.join(ffDir, 'facefusion.py');
}

/**
 * Construit les arguments pour la commande FaceFusion
 */
function buildArgs(options: FaceswapOptions): string[] {
  const args: string[] = ['headless-run'];

  // Chemins obligatoires
  if (options.lipSyncerModel) {
    // Le lip syncer requiert une source audio. On passe la cible en tant que source audio.
    args.push('-s', path.resolve(options.sourcePath), path.resolve(options.targetPath));
  } else {
    args.push('-s', path.resolve(options.sourcePath));
  }
  args.push('-t', path.resolve(options.targetPath));
  args.push('-o', path.resolve(options.outputPath));

  // Execution providers (par défaut: coreml, cpu pour Mac Silicon)
  const providers = options.executionProviders ?? ['coreml', 'cpu'];
  args.push('--execution-providers', ...providers);

  // Face selector mode
  if (options.faceSelectorMode) {
    args.push('--face-selector-mode', options.faceSelectorMode);
  }

  // Thread count
  if (options.threadCount) {
    args.push('--execution-thread-count', options.threadCount.toString());
  }

  // Log level
  if (options.logLevel) {
    args.push('--log-level', options.logLevel);
  }

  // Keep temp
  if (options.keepTemp) {
    args.push('--keep-temp');
  }

  // Processors & Models
  const processors: string[] = [];

  // Face Swapper
  if (options.faceSwapperModel) {
    processors.push('face_swapper');
    args.push('--face-swapper-model', options.faceSwapperModel);
  }

  // Face Enhancer
  if (options.faceEnhancerModel) {
    processors.push('face_enhancer');
    args.push('--face-enhancer-model', options.faceEnhancerModel);
  }

  // Face Enhancer Blend (maps to --face-enhancer-blend in FaceFusion)
  if (options.faceEnhancerBlend !== undefined) {
    args.push('--face-enhancer-blend', Math.round(options.faceEnhancerBlend).toString());
  }

  // Frame Enhancer
  if (options.frameEnhancerModel) {
    processors.push('frame_enhancer');
    args.push('--frame-enhancer-model', options.frameEnhancerModel);
  }

  // Lip Syncer
  if (options.lipSyncerModel) {
    processors.push('lip_syncer');
    args.push('--lip-syncer-model', options.lipSyncerModel);
  }

  // Expression Restorer
  if (options.expressionRestorerModel) {
    processors.push('expression_restorer');
    args.push('--expression-restorer-model', options.expressionRestorerModel);
  }

  // Face Mask Blend (maps to --face-mask-blur in FaceFusion)
  if (options.faceMaskBlend !== undefined) {
    args.push('--face-mask-blur', (options.faceMaskBlend / 100).toString());
  }

  if (processors.length > 0) {
    args.push('--processors', ...processors);
  }

  // Temp path pointing to ~/.meme-swap/process/temp/facefusion-temp
  const facefusionTemp = path.join(
    os.homedir(),
    '.meme-swap',
    'process',
    'temp',
    'facefusion-temp',
  );
  if (!fs.existsSync(facefusionTemp)) {
    fs.mkdirSync(facefusionTemp, { recursive: true });
  }
  args.push('--temp-path', facefusionTemp);

  return args;
}

/**
 * Exécute FaceFusion pour effectuer un face swap
 *
 * @param options - Options de configuration du face swap
 * @returns Promise résolvant le résultat de l'opération
 *
 * @example
 * ```typescript
 * const result = await runFaceSwap({
 *   sourcePath: './test-images/source.jpg',
 *   targetPath: '~/.meme-swap/process/temp/target.mp4',
 *   outputPath: '~/.meme-swap/process/results/output.mp4',
 *   executionProviders: ['coreml', 'cpu']
 * });
 *
 * if (result.success) {
 *   console.info('Face swap réussi:', result.outputPath);
 * }
 * ```
 */
export async function runFaceSwap(options: FaceswapOptions): Promise<FaceswapResult> {
  const pythonPath = getPythonPath();
  const scriptPath = getScriptPath();
  const args = buildArgs(options);

  // Vérification des chemins : FaceFusion/Python absent ou non installé.
  // Renvoyé comme un FaceswapResult classifié plutôt que levé en exception,
  // pour que tous les appelants (déjà écrits pour `await`er un résultat, pas
  // pour catcher une FaceswapError) reçoivent la même forme de réponse que
  // pour n'importe quel autre échec, avec errorCode='missing-install' pour
  // permettre au frontend de proposer de relancer l'assistant d'installation
  // plutôt qu'un message générique.
  if (!existsSync(pythonPath)) {
    return {
      success: false,
      error: `FaceFusion's Python environment was not found at ${pythonPath}. Run the setup wizard again to (re)install FaceFusion.`,
      errorCode: 'missing-install',
    };
  }

  if (!existsSync(scriptPath)) {
    return {
      success: false,
      error: `FaceFusion is not installed (missing facefusion.py at ${scriptPath}). Run the setup wizard to install it.`,
      errorCode: 'missing-install',
    };
  }

  return new Promise((resolve) => {
    const childProcess = spawn(pythonPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        // FaceFusion shells out to ffmpeg itself; prepend Homebrew's bin dirs so it
        // resolves the live, correctly-linked binary instead of whatever the host
        // process's own PATH happens to carry (GUI-launched apps on macOS often get
        // a minimal PATH that omits Homebrew entirely).
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'}`,
      },
    });

    options.onProcessStart?.(childProcess);

    let stderr = '';

    // Collecte des logs stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.info('[FaceFusion]', output.trim());
      if (options.onProgress) {
        parseProgress(output, options.onProgress);
      }
    });

    // Collecte des erreurs stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      stderr += error;
      console.error('[FaceFusion Error]', error.trim());
      if (options.onProgress) {
        parseProgress(error, options.onProgress);
      }
    });

    // Gestion de la fin du processus
    childProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({
          success: true,
          outputPath: options.outputPath,
        });
      } else {
        resolve({
          success: false,
          error: stderr || `FaceFusion exited with code ${code}`,
        });
      }
    });

    // Gestion des erreurs de spawn. pythonPath a déjà été validé plus haut ;
    // un ENOENT ici signifierait une suppression concurrente du binaire entre
    // la vérification et le spawn — rare, mais on le classe quand même comme
    // 'missing-install' plutôt que comme une erreur générique. Toute autre
    // erreur de spawn (permissions, binaire corrompu, etc.) indique une
    // installation présente mais cassée : 'broken-install'.
    childProcess.on('error', (err: Error) => {
      const isMissingBinary = err.message.includes('ENOENT');
      resolve({
        success: false,
        error: isMissingBinary
          ? `FaceFusion's Python environment appears to have disappeared (${err.message}). Run the setup wizard again to (re)install FaceFusion.`
          : `Failed to launch FaceFusion (installation may be broken): ${err.message}. Run the setup wizard again to reinstall FaceFusion.`,
        errorCode: isMissingBinary ? 'missing-install' : 'broken-install',
      });
    });
  });
}

/**
 * Parse tqdm progress bar patterns from FaceFusion output
 */
function parseProgress(
  data: string,
  onProgress: (progress: { step: string; percent: number }) => void,
): void {
  const regex = /(analysing|extracting|processing|merging):\s*(\d+)%/i;
  const match = data.match(regex);
  if (match && match[1] && match[2]) {
    const step = match[1].toLowerCase();
    const percent = parseInt(match[2], 10);
    onProgress({ step, percent });
  }
}

/**
 * Vérifie si un fichier existe
 */
function existsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}
