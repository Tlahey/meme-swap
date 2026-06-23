import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runFaceSwap, FaceswapOptions } from '@meme-swap/faceswap-core';
import { gifToMp4, mp4ToGif } from '@meme-swap/video-processor';

// Configuration des chemins
const PROCESS_DIR = path.join(os.homedir(), '.meme-swap', 'process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');
const RESULTS_DIR = path.join(PROCESS_DIR, 'results');

/**
 * Initialise les dossiers de travail s'ils n'existent pas
 */
function ensureDirectories(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Supprime les fichiers temporaires et les résultats précédents au début de chaque run
 */
function cleanupProcessDirs(): void {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      console.log('[API] Dossier temporaire nettoyé');
    } catch (error) {
      console.error('[API] Erreur de nettoyage du dossier temporaire:', error);
    }
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  if (fs.existsSync(RESULTS_DIR)) {
    try {
      fs.rmSync(RESULTS_DIR, { recursive: true, force: true });
      console.log('[API] Dossier de résultats nettoyé');
    } catch (error) {
      console.error('[API] Erreur de nettoyage du dossier de résultats:', error);
    }
  }
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Génère un nom de fichier unique
 */
function generateFileName(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${extension}`;
}

/**
 * Timeout wrapper pour éviter que le traitement ne bloque indéfiniment
 * (FaceFusion peut prendre 2-5 min sur Mac Silicon)
 */
async function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * API Route pour effectuer un face swap
 *
 * POST /api/faceswap
 * Body: FormData avec 'source' (image) et 'target' (GIF/MP4)
 */
export async function POST(request: NextRequest) {
  // Timeout de 10 minutes pour le traitement FaceFusion
  const TIMEOUT_MS = 10 * 60 * 1000;

  try {
    ensureDirectories();
    cleanupProcessDirs();

    // Récupérer les fichiers du formulaire
    const formData = await request.formData();
    const sourceEntry = formData.get('source');
    const targetFile = formData.get('target') as File | null;

    if (!sourceEntry || !targetFile) {
      return NextResponse.json(
        { success: false, error: 'Fichiers manquants dans la requête' },
        { status: 400 },
      );
    }

    // Générer les noms de fichiers
    const sourceFileName = generateFileName('jpg');
    const targetFileName = generateFileName('gif');
    const tempMp4Name = generateFileName('mp4');
    const outputMp4Name = generateFileName('mp4');
    const outputGifName = generateFileName('gif');

    // Chemins complets
    const sourcePath = path.join(TEMP_DIR, sourceFileName);
    const targetPath = path.join(TEMP_DIR, targetFileName);
    const tempMp4Path = path.join(TEMP_DIR, tempMp4Name);
    const outputMp4Path = path.join(RESULTS_DIR, outputMp4Name);
    const outputGifPath = path.join(RESULTS_DIR, outputGifName);

    // Sauvegarder le fichier source ou le recuperer de l'historique
    if (typeof sourceEntry === 'string' && sourceEntry.startsWith('history:')) {
      const historyFilename = sourceEntry.replace('history:', '');
      const historyFilePath = path.join(os.homedir(), '.meme-swap', 'source-history', historyFilename);
      if (!fs.existsSync(historyFilePath)) {
        return NextResponse.json(
          { success: false, error: `Le visage de l'historique ${historyFilename} n'existe pas` },
          { status: 400 },
        );
      }
      fs.copyFileSync(historyFilePath, sourcePath);
    } else if (sourceEntry instanceof File) {
      const sourceBuffer = await sourceEntry.arrayBuffer();
      fs.writeFileSync(sourcePath, Buffer.from(sourceBuffer));
    } else {
      return NextResponse.json(
        { success: false, error: 'Format du visage source invalide' },
        { status: 400 },
      );
    }

    const targetBuffer = await targetFile.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(targetBuffer));

    console.log('[API] Fichiers sauvegardés');
    console.log(`  Source: ${sourcePath}`);
    console.log(`  Target: ${targetPath}`);

    // Étape 1: Convertir GIF en MP4 si nécessaire
    let targetForFaceswap = targetPath;

    if (targetFile.name.toLowerCase().endsWith('.gif')) {
      console.log('[API] Conversion GIF → MP4...');

      const gifToMp4Result = await gifToMp4({
        inputPath: targetPath,
        outputPath: tempMp4Path,
      });

      if (!gifToMp4Result.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Conversion GIF→MP4 échouée: ${gifToMp4Result.error}`,
          },
          { status: 500 },
        );
      }

      targetForFaceswap = tempMp4Path;
      console.log('[API] Conversion terminée');
    } else if (targetFile.name.toLowerCase().endsWith('.mp4')) {
      // Le fichier est déjà un MP4
      targetForFaceswap = targetPath;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Format de fichier non supporté. Utilisez GIF ou MP4.',
        },
        { status: 400 },
      );
    }

    // Récupérer les paramètres avancés de génération
    const rawProviders = formData.get('executionProviders') as string | null;
    const executionProviders: ('coreml' | 'cpu' | 'cuda')[] = rawProviders
      ? (rawProviders.split(',') as ('coreml' | 'cpu' | 'cuda')[])
      : ['coreml', 'cpu'];

    const faceSelectorMode =
      (formData.get('faceSelectorMode') as string | null) || undefined;

    const rawThreadCount = formData.get('threadCount') as string | null;
    const threadCount = rawThreadCount
      ? parseInt(rawThreadCount, 10)
      : undefined;

    const logLevel =
      (formData.get('logLevel') as
        | 'debug'
        | 'info'
        | 'warning'
        | 'error'
        | null) || undefined;

    const rawFaceMaskBlend = formData.get('faceMaskBlend') as string | null;
    const faceMaskBlend = rawFaceMaskBlend
      ? parseInt(rawFaceMaskBlend, 10)
      : undefined;

    const faceSwapperModel =
      (formData.get('faceSwapperModel') as string | null) || undefined;
    const faceEnhancerModel =
      (formData.get('faceEnhancerModel') as string | null) || undefined;
    
    const rawFaceEnhancerBlend = formData.get('faceEnhancerBlend') as string | null;
    const faceEnhancerBlend = rawFaceEnhancerBlend
      ? parseInt(rawFaceEnhancerBlend, 10)
      : undefined;

    const frameEnhancerModel =
      (formData.get('frameEnhancerModel') as string | null) || undefined;

    const lipSyncerModel =
      (formData.get('lipSyncerModel') as string | null) || undefined;

    // Étape 2: Exécuter FaceFusion pour le face swap
    console.log('[API] Lancement du face swap...');

    const faceswapOptions: FaceswapOptions = {
      sourcePath,
      targetPath: targetForFaceswap,
      outputPath: outputMp4Path,
      executionProviders,
      faceSelectorMode,
      threadCount,
      logLevel,
      faceMaskBlend,
      faceSwapperModel,
      faceEnhancerModel,
      faceEnhancerBlend,
      frameEnhancerModel,
      lipSyncerModel,
    };

    const faceswapResult = await runFaceSwap(faceswapOptions);

    if (!faceswapResult.success) {
      return NextResponse.json(
        { success: false, error: `Face swap échoué: ${faceswapResult.error}` },
        { status: 500 },
      );
    }

    console.log('[API] Face swap terminé');

    // Étape 3: Reconvertir MP4 en GIF pour l'affichage
    console.log('[API] Conversion MP4 → GIF...');

    const mp4ToGifResult = await mp4ToGif({
      inputPath: outputMp4Path,
      outputPath: outputGifPath,
      fps: 10,
      maxWidth: 320,
    });

    if (!mp4ToGifResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Conversion MP4→GIF échouée: ${mp4ToGifResult.error}`,
        },
        { status: 500 },
      );
    }

    console.log('[API] Conversion terminée');

    // Construire l'URL publique pour le résultat
    const resultFileName = path.basename(outputGifPath);
    const resultUrl = `/api/results/${resultFileName}`;

    return NextResponse.json({
      success: true,
      outputPath: resultUrl,
      message: 'Face swap réussi',
    });
  } catch (error) {
    console.error('[API] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 },
    );
  }
}
