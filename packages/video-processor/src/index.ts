import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

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
 * Résultat d'une opération de conversion
 */
export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Error thrown when video processing operation fails
 */
export class VideoProcessorError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
    public details?: Partial<ConversionOptions>,
  ) {
    super(message);
    this.name = 'VideoProcessorError';
  }
}

/**
 * Vérifie si ffmpeg est disponible sur le système
 */
function getFfmpegPath(): string {
  const userHomeFfmpeg = path.join(/*turbopackIgnore: true*/ os.homedir(), '.meme-swap', 'bin', 'ffmpeg');
  if (fs.existsSync(userHomeFfmpeg)) {
    return userHomeFfmpeg;
  }
  return 'ffmpeg';
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
          error: stderr || `FFmpeg terminé avec le code ${code}`,
        });
      }
    });

    process.on('error', (err: Error) => {
      if (err.message.includes('not found') || err.message.includes('ENOENT')) {
        resolve({
          success: false,
          error:
            "FFmpeg n'est pas installé. Installez-le avec: brew install ffmpeg",
        });
      } else {
        resolve({
          success: false,
          error: `Erreur FFmpeg: ${err.message}`,
        });
      }
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

    // Nom temporaire pour la palette
    const tempPalette = path.join(path.dirname(outputPath), 'palette.png');

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
          error: `Échec de la génération de palette: ${pass1Error}`,
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
            error: pass2Error || `FFmpeg terminé avec le code ${code}`,
          });
        }
      });

      pass2.on('error', (err: Error) => {
        resolve({
          success: false,
          error: `Erreur FFmpeg: ${err.message}`,
        });
      });
    });

    pass1.on('error', (err: Error) => {
      if (err.message.includes('not found') || err.message.includes('ENOENT')) {
        resolve({
          success: false,
          error:
            "FFmpeg n'est pas installé. Installez-le avec: brew install ffmpeg",
        });
      } else {
        resolve({
          success: false,
          error: `Erreur FFmpeg: ${err.message}`,
        });
      }
    });
  });
}
