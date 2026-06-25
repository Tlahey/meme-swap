import { spawn, SpawnOptions } from 'node:child_process';
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
}

/**
 * Résultat d'une opération de face swap
 */
export interface FaceswapResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Error thrown when faceswap operation fails
 */
export class FaceswapError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
    public details?: Partial<FaceswapOptions>,
  ) {
    super(message);
    this.name = 'FaceswapError';
  }
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
  const facefusionTemp = path.join(os.homedir(), '.meme-swap', 'process', 'temp', 'facefusion-temp');
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
 *   targetPath: './.process/temp/target.mp4',
 *   outputPath: './.process/results/output.mp4',
 *   executionProviders: ['coreml', 'cpu']
 * });
 *
 * if (result.success) {
 *   console.log('Face swap réussi:', result.outputPath);
 * }
 * ```
 */
export async function runFaceSwap(
  options: FaceswapOptions,
): Promise<FaceswapResult> {
  const pythonPath = getPythonPath();
  const scriptPath = getScriptPath();
  const args = buildArgs(options);

  // Vérification des chemins
  if (!existsSync(pythonPath)) {
    throw new FaceswapError(
      `Python de FaceFusion non trouvé à: ${pythonPath}`,
      null,
      options,
    );
  }

  if (!existsSync(scriptPath)) {
    throw new FaceswapError(
      `Script FaceFusion non trouvé à: ${scriptPath}`,
      null,
      options,
    );
  }

  const binDir = path.join(os.homedir(), '.meme-swap', 'bin');
  return new Promise((resolve) => {
    const childProcess = spawn(pythonPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'}`
      }
    });

    let stdout = '';
    let stderr = '';

    // Collecte des logs stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      console.log('[FaceFusion]', output.trim());
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
          error: stderr || `Processus terminé avec le code ${code}`,
        });
      }
    });

    // Gestion des erreurs de spawn
    childProcess.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Erreur lors du lancement de FaceFusion: ${err.message}`,
      });
    });
  });
}

/**
 * Parse tqdm progress bar patterns from FaceFusion output
 */
function parseProgress(data: string, onProgress: (progress: { step: string; percent: number }) => void): void {
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
