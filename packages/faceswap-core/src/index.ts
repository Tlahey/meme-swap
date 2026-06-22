import { spawn, SpawnOptions } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

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
  /** Lip syncer model to use (if true, lip_syncer processor is added) */
  lipSyncerModel?: string;
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
 * Trouve le répertoire racine du projet (workspace) contenant le dossier vendor/facefusion
 */
function getWorkspaceRoot(): string {
  let currentDir = process.cwd();
  // Remonter les dossiers parents pour trouver vendor/facefusion
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'vendor', 'facefusion'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd(); // Fallback
}

/**
 * Chemin vers le binaire Python de l'environnement virtuel FaceFusion
 */
function getPythonPath(): string {
  const root = getWorkspaceRoot();
  // Utiliser python3.11 si disponible (plus stable pour FaceFusion)
  const python311Path = path.join(
    root,
    'vendor',
    'facefusion',
    'venv',
    'bin',
    'python3.11',
  );
  if (fs.existsSync(python311Path)) {
    return python311Path;
  }
  // Fallback vers python3
  return path.join(root, 'vendor', 'facefusion', 'venv', 'bin', 'python3');
}

/**
 * Chemin vers le script principal de FaceFusion
 */
function getScriptPath(): string {
  const root = getWorkspaceRoot();
  return path.join(root, 'vendor', 'facefusion', 'facefusion.py');
}

/**
 * Construit les arguments pour la commande FaceFusion
 */
function buildArgs(options: FaceswapOptions): string[] {
  const args: string[] = ['headless-run'];

  // Chemins obligatoires
  args.push('-s', path.resolve(options.sourcePath));
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

  // Lip Syncer
  if (options.lipSyncerModel) {
    processors.push('lip_syncer');
    args.push('--lip-syncer-model', options.lipSyncerModel);
  }

  // Face Mask Blend
  if (options.faceMaskBlend !== undefined) {
    args.push('--face-mask-blend', options.faceMaskBlend.toString());
  }

  if (processors.length > 0) {
    args.push('--processors', ...processors);
  }

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

  return new Promise((resolve) => {
    const process = spawn(pythonPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath),
    });

    let stdout = '';
    let stderr = '';

    // Collecte des logs stdout
    process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      console.log('[FaceFusion]', output.trim());
    });

    // Collecte des erreurs stderr
    process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      stderr += error;
      console.error('[FaceFusion Error]', error.trim());
    });

    // Gestion de la fin du processus
    process.on('close', (code) => {
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
    process.on('error', (err) => {
      resolve({
        success: false,
        error: `Erreur lors du lancement de FaceFusion: ${err.message}`,
      });
    });
  });
}

/**
 * Vérifie si un fichier existe
 */
function existsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}
