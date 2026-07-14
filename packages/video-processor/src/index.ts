import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Options pour la conversion de fichiers média
 */
export interface ConversionOptions {
  /** Chemin vers le fichier d'entrée */
  inputPath: string;
  /** Chemin vers le fichier de sortie */
  outputPath: string;
  /** FPS pour la conversion en GIF (par défaut: 10) */
  fps?: number;
  /** Largeur maximale pour la conversion (par défaut: 320) */
  maxWidth?: number;
}

/**
 * Closed set of environment/install problems this package can classify, kept
 * as an independent literal type mirroring faceswap-core's FaceswapErrorCode
 * (same string values) since neither package depends on the other. See that
 * type's doc comment for how this threads through to the frontend/desktop.
 */
export type ConversionErrorCode = 'missing-install' | 'broken-install';

/**
 * Résultat d'une opération de conversion
 */
export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  errorCode?: ConversionErrorCode;
}

/**
 * Homebrew keeps its formulae's binaries and shared libraries in sync on every
 * upgrade, so resolving ffmpeg through these paths (rather than a copy taken at
 * install time) can never go stale.
 */
const HOMEBREW_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

function findHomebrewFfmpeg(): string | null {
  for (const dir of HOMEBREW_BIN_DIRS) {
    const candidate = path.join(dir, 'ffmpeg');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getFfmpegPath(): string {
  return findHomebrewFfmpeg() ?? 'ffmpeg';
}

/**
 * Vérifie si ffmpeg est disponible sur le système (Homebrew ou PATH)
 */
export function isFfmpegInstalled(): boolean {
  if (findHomebrewFfmpeg() !== null) {
    return true;
  }
  try {
    execSync('which ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Substrings that show up in ffmpeg's stderr when the binary itself exists
 * but its dynamic library links are broken — the exact failure mode that
 * broke real swaps on this machine when a stale copy of ffmpeg (taken at
 * install time) survived a `brew upgrade ffmpeg` that moved its shared
 * libraries. Resolving ffmpeg live from Homebrew's bin dirs (see
 * findHomebrewFfmpeg above) fixes the common case; this pattern exists for
 * if it ever happens again anyway (corrupted install, mid-upgrade state,
 * etc). Kept narrow and dyld/library-loading-specific so an ordinary
 * encoding error never gets misclassified as an install problem.
 */
const BROKEN_INSTALL_STDERR_PATTERN = /dyld|library not loaded|image not found/i;

function isMissingBinaryError(err: Error): boolean {
  return err.message.includes('ENOENT') || err.message.includes('not found');
}

/**
 * Classifies a spawn-level failure (the process never started at all).
 */
function classifyFfmpegSpawnError(
  err: Error,
): { error: string; errorCode: ConversionErrorCode } {
  if (isMissingBinaryError(err)) {
    return {
      error: 'FFmpeg is not installed. Install it with: brew install ffmpeg',
      errorCode: 'missing-install',
    };
  }
  return {
    error: `FFmpeg failed to start (${err.message}). Your FFmpeg installation may be corrupted — try reinstalling it with: brew reinstall ffmpeg`,
    errorCode: 'broken-install',
  };
}

/**
 * Classifies a non-zero exit (the process started but failed). `context`
 * describes which phase failed (e.g. "converting GIF to MP4") for a more
 * specific message; falls back to the raw stderr when nothing looks like a
 * broken install, matching the previous behavior.
 */
function classifyFfmpegExit(
  code: number | null,
  stderr: string,
  context: string,
): { error: string; errorCode?: ConversionErrorCode } {
  if (BROKEN_INSTALL_STDERR_PATTERN.test(stderr)) {
    return {
      error:
        `FFmpeg crashed while ${context} (exit code ${code}). This looks like a broken FFmpeg ` +
        `install rather than a normal encoding error — try reinstalling it with: brew reinstall ffmpeg\n\n${stderr}`,
      errorCode: 'broken-install',
    };
  }
  return {
    error: stderr || `FFmpeg exited with code ${code}`,
  };
}

/**
 * Convertit un GIF en MP4 utilisant FFmpeg
 *
 * @param options - Options de conversion
 * @returns Promise résolvant le résultat de l'opération
 *
 * @example
 * ```typescript
 * const result = await gifToMp4({
 *   inputPath: './input.gif',
 *   outputPath: './output.mp4'
 * });
 *
 * if (result.success) {
 *   console.log('Conversion réussie:', result.outputPath);
 * }
 * ```
 */
export async function gifToMp4(
  options: ConversionOptions,
): Promise<ConversionResult> {
  const { inputPath, outputPath } = options;

  // Vérifier que le fichier d'entrée existe
  if (!fs.existsSync(inputPath)) {
    return {
      success: false,
      error: `Fichier d'entrée non trouvé: ${inputPath}`,
    };
  }

  // Créer le dossier de sortie s'il n'existe pas
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();

    // Arguments pour convertir GIF en MP4
    // -i: input file
    // -movflags faststart: optimise pour le streaming web
    // -c:v libx264: codec vidéo H.264
    // -pix_fmt yuv420p: format de pixel compatible
    const args = [
      '-i',
      inputPath,
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-movflags',
      'faststart',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outputPath,
    ];

    console.log(`[FFmpeg] Conversion GIF → MP4: ${inputPath} → ${outputPath}`);

    const process = spawn(ffmpegPath, args);

    let stderr = '';

    process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      stderr += error;
      // FFmpeg écrit les logs sur stderr
      console.log(`[FFmpeg] ${error.trim()}`);
    });

    process.on('close', (code: number) => {
      if (code === 0) {
        resolve({
          success: true,
          outputPath,
        });
      } else {
        resolve({
          success: false,
          ...classifyFfmpegExit(code, stderr, 'converting GIF to MP4'),
        });
      }
    });

    process.on('error', (err: Error) => {
      resolve({
        success: false,
        ...classifyFfmpegSpawnError(err),
      });
    });
  });
}

/**
 * Convertit un MP4 en GIF utilisant FFmpeg avec palette two-pass
 *
 * @param options - Options de conversion
 * @returns Promise résolvant le résultat de l'opération
 *
 * @example
 * ```typescript
 * const result = await mp4ToGif({
 *   inputPath: './input.mp4',
 *   outputPath: './output.gif',
 *   fps: 10,
 *   maxWidth: 320
 * });
 *
 * if (result.success) {
 *   console.log('Conversion réussie:', result.outputPath);
 * }
 * ```
 */
export async function mp4ToGif(
  options: ConversionOptions,
): Promise<ConversionResult> {
  const { inputPath, outputPath, fps = 10, maxWidth = 320 } = options;

  // Vérifier que le fichier d'entrée existe
  if (!fs.existsSync(inputPath)) {
    return {
      success: false,
      error: `Fichier d'entrée non trouvé: ${inputPath}`,
    };
  }

  // Créer le dossier de sortie s'il n'existe pas
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();

    // Nom temporaire unique pour la palette (évite les collisions entre
    // conversions simultanées écrivant dans le même dossier de sortie)
    const paletteName = `palette-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}.png`;
    const tempPalette = path.join(path.dirname(outputPath), paletteName);

    console.log(`[FFmpeg] Conversion MP4 → GIF: ${inputPath} → ${outputPath}`);

    // Two-pass pour un GIF de qualité optimale
    // Pass 1: Générer la palette de couleurs
    const pass1Args = [
      '-i',
      inputPath,
      '-vf',
      `fps=${fps},scale=${maxWidth}:-1:flags=lanczos,palettegen`,
      '-y',
      tempPalette,
    ];

    const pass1 = spawn(ffmpegPath, pass1Args);

    let pass1Error = '';
    pass1.stderr?.on('data', (data: Buffer) => {
      pass1Error += data.toString();
    });

    pass1.on('close', (code: number) => {
      if (code !== 0) {
        resolve({
          success: false,
          ...classifyFfmpegExit(code, pass1Error, 'generating the color palette'),
        });
        return;
      }

      // Pass 2: Utiliser la palette pour créer le GIF
      const pass2Args = [
        '-i',
        inputPath,
        '-i',
        tempPalette,
        '-filter_complex',
        `[0:v]fps=${fps},scale=${maxWidth}:-1:flags=lanczos[v];[v][1:v]paletteuse`,
        '-y',
        outputPath,
      ];

      const pass2 = spawn(ffmpegPath, pass2Args);

      let pass2Error = '';
      pass2.stderr?.on('data', (data: Buffer) => {
        pass2Error += data.toString();
      });

      pass2.on('close', (code: number) => {
        // Nettoyer la palette temporaire
        fs.unlink(tempPalette, () => {
          // Ignore les erreurs de suppression
        });

        if (code === 0) {
          resolve({
            success: true,
            outputPath,
          });
        } else {
          resolve({
            success: false,
            ...classifyFfmpegExit(code, pass2Error, 'converting MP4 to GIF'),
          });
        }
      });

      pass2.on('error', (err: Error) => {
        // Nettoyer la palette temporaire (même si le spawn de pass 2 échoue)
        fs.unlink(tempPalette, () => {
          // Ignore les erreurs de suppression
        });

        resolve({
          success: false,
          ...classifyFfmpegSpawnError(err),
        });
      });
    });

    pass1.on('error', (err: Error) => {
      resolve({
        success: false,
        ...classifyFfmpegSpawnError(err),
      });
    });
  });
}
