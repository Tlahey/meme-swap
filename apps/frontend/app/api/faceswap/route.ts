import { NextRequest } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runFaceSwap, FaceswapOptions } from '@meme-swap/faceswap-core';
import { gifToMp4, mp4ToGif } from '@meme-swap/video-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Événement de progression envoyé au client via SSE. `stepIndex` correspond
 * à l'index (0-3) du composant ProcessSteps côté frontend : upload,
 * préprocessing, inférence, finalisation. `faceswapProgress` n'est renseigné
 * que pendant l'étape d'inférence (index 2), avec les valeurs brutes
 * remontées par FaceFusion (tqdm).
 */
interface FaceswapProgressEvent {
  stepIndex: number;
  status: 'running' | 'completed';
  faceswapProgress: { step: string; percent: number } | null;
}

/**
 * Événement final (unique) envoyé au client, qu'il s'agisse d'un succès ou
 * d'un échec — remplace les anciennes réponses JSON directes. `errorCode`
 * n'est renseigné que pour les échecs classifiés comme un problème
 * d'install/environnement (FaceFusion/Python/ffmpeg manquant ou cassé, voir
 * FaceswapErrorCode / ConversionErrorCode) plutôt qu'un échec de swap
 * ordinaire, pour que le frontend puisse afficher un message et un call-to-
 * action différents sans re-parser la chaîne d'erreur.
 */
interface FaceswapDoneEvent {
  success: boolean;
  outputPath?: string;
  error?: string;
  errorCode?: 'missing-install' | 'broken-install';
}

// Configuration des chemins
const PROCESS_DIR = path.join(os.homedir(), '.meme-swap', 'process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');
const RESULTS_DIR = path.join(PROCESS_DIR, 'results');

/**
 * Nombre de résultats conservés dans RESULTS_DIR pour l'historique de
 * re-téléchargement. Les fichiers résultats sont petits (un GIF de sortie
 * pèse typiquement quelques centaines de Ko), donc une limite plus généreuse
 * que celle de l'historique des visages source (5) reste peu coûteuse en
 * espace disque tout en étant plus utile pour parcourir des essais passés.
 */
const RESULTS_HISTORY_LIMIT = 20;

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
 * Cap safety net proportionné pour TEMP_DIR. Le nettoyage par requête
 * ci-dessous purge déjà TEMP_DIR sans condition avant chaque run, mais cette
 * purge avale silencieusement ses erreurs (voir le try/catch), et elle ne se
 * déclenche que si un *autre* swap a lieu ensuite — un run planté ou
 * abandonné sans requête suivante laisse ses fichiers pour toujours. Ce n'est
 * pas un timer d'arrière-plan (rien d'autre dans ce code base n'en a un) :
 * juste un contrôle de taille à chaque appel de cleanupProcessDirs(), qui
 * force une purge complète et logue bruyamment si TEMP_DIR devient
 * anormalement gros, pour qu'une suppression silencieusement en échec
 * devienne visible plutôt qu'invisible.
 *
 * L'empreinte temp d'un seul run (source, MP4 converti, dossier de travail
 * frames de FaceFusion, MP4 de sortie avant reconversion) se situe
 * typiquement entre quelques dizaines et quelques centaines de Mo. 2 Go est
 * environ un ordre de grandeur au-dessus d'un run lourd isolé : le franchir
 * signifie soit plusieurs runs abandonnés accumulés, soit une purge en échec
 * silencieux — pas un usage normal à un seul run.
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

  console.error(
    `[API][Cleanup] SAFETY NET: ${TEMP_DIR} has reached ${(sizeBytes / (1024 * 1024)).toFixed(0)} MB, ` +
      `above the ${(TEMP_DIR_SAFETY_CAP_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB cap for normal single-run usage. ` +
      'Forcing a full purge — this usually means a previous cleanup silently failed, or several runs were abandoned without a follow-up swap.',
  );

  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error(`[API][Cleanup] SAFETY NET purge also failed for ${TEMP_DIR}:`, error);
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
      console.log('[API] Dossier temporaire nettoyé');
    } catch (error) {
      console.error('[API] Erreur de nettoyage du dossier temporaire:', error);
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
      } catch (error) {
        console.error(`[API] Failed to delete old result file: ${info.name}`, error);
      }
    }
  }
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
 * API Route pour effectuer un face swap
 *
 * POST /api/faceswap
 * Body: FormData avec 'source' (image) et 'target' (GIF/MP4)
 *
 * Réponse: flux Server-Sent Events (text/event-stream). Deux types
 * d'événements sont émis : "progress" (FaceswapProgressEvent, transitions
 * d'étapes + progression fine de l'inférence FaceFusion) et un unique
 * événement terminal "done" (FaceswapDoneEvent) qui remplace les anciennes
 * réponses JSON de succès/échec.
 *
 * FormData ne peut pas être envoyé via une requête GET (donc pas
 * d'EventSource natif) : le client doit utiliser fetch() en POST et lire
 * response.body via un ReadableStreamDefaultReader.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Le client a probablement fermé la connexion.
          closed = true;
        }
      };

      const sendProgress = (
        stepIndex: number,
        status: 'running' | 'completed',
        faceswapProgress: { step: string; percent: number } | null = null,
      ) => {
        sendEvent('progress', {
          stepIndex,
          status,
          faceswapProgress,
        } satisfies FaceswapProgressEvent);
      };

      const finish = (result: FaceswapDoneEvent) => {
        sendEvent('done', result);
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        ensureDirectories();
        cleanupProcessDirs();

        // Étape 0: Upload & validation
        sendProgress(0, 'running');

        // Récupérer les fichiers du formulaire
        const formData = await request.formData();
        const sourceEntry = formData.get('source');
        const targetFile = formData.get('target') as File | null;

        if (!sourceEntry || !targetFile) {
          finish({ success: false, error: 'Fichiers manquants dans la requête' });
          return;
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
        // outputMp4Path est un intermédiaire : cette route reconvertit toujours
        // le résultat en GIF (étape 3 ci-dessous), le MP4 n'est jamais servi
        // directement — il vit donc dans TEMP_DIR, pas RESULTS_DIR.
        const outputMp4Path = path.join(TEMP_DIR, outputMp4Name);
        const outputGifPath = path.join(RESULTS_DIR, outputGifName);

        // Sauvegarder le fichier source ou le recuperer de l'historique
        if (typeof sourceEntry === 'string' && sourceEntry.startsWith('history:')) {
          const historyFilename = sourceEntry.replace('history:', '');
          const historyFilePath = path.join(
            os.homedir(),
            '.meme-swap',
            'source-history',
            historyFilename,
          );
          if (!fs.existsSync(historyFilePath)) {
            finish({
              success: false,
              error: `Le visage de l'historique ${historyFilename} n'existe pas`,
            });
            return;
          }
          fs.copyFileSync(historyFilePath, sourcePath);
        } else if (sourceEntry instanceof File) {
          const sourceBuffer = await sourceEntry.arrayBuffer();
          fs.writeFileSync(sourcePath, Buffer.from(sourceBuffer));
        } else {
          finish({ success: false, error: 'Format du visage source invalide' });
          return;
        }

        const targetBuffer = await targetFile.arrayBuffer();
        fs.writeFileSync(targetPath, Buffer.from(targetBuffer));

        console.log('[API] Fichiers sauvegardés');
        console.log(`  Source: ${sourcePath}`);
        console.log(`  Target: ${targetPath}`);

        sendProgress(0, 'completed');

        // Étape 1: Convertir GIF en MP4 si nécessaire
        sendProgress(1, 'running');

        let targetForFaceswap = targetPath;

        if (targetFile.name.toLowerCase().endsWith('.gif')) {
          console.log('[API] Conversion GIF → MP4...');

          const gifToMp4Result = await gifToMp4({
            inputPath: targetPath,
            outputPath: tempMp4Path,
          });

          if (!gifToMp4Result.success) {
            finish({
              success: false,
              error: `GIF→MP4 conversion failed: ${gifToMp4Result.error}`,
              errorCode: gifToMp4Result.errorCode,
            });
            return;
          }

          targetForFaceswap = tempMp4Path;
          console.log('[API] Conversion terminée');
        } else if (targetFile.name.toLowerCase().endsWith('.mp4')) {
          // Le fichier est déjà un MP4
          targetForFaceswap = targetPath;
        } else {
          finish({
            success: false,
            error: 'Format de fichier non supporté. Utilisez GIF ou MP4.',
          });
          return;
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

        const rawFaceEnhancerBlend = formData.get('faceEnhancerBlend') as
          | string
          | null;
        const faceEnhancerBlend = rawFaceEnhancerBlend
          ? parseInt(rawFaceEnhancerBlend, 10)
          : undefined;

        const frameEnhancerModel =
          (formData.get('frameEnhancerModel') as string | null) || undefined;

        const expressionRestorerModel =
          (formData.get('expressionRestorerModel') as string | null) || undefined;

        const lipSyncerModel =
          (formData.get('lipSyncerModel') as string | null) || undefined;

        sendProgress(1, 'completed');

        // Étape 2: Exécuter FaceFusion pour le face swap
        sendProgress(2, 'running');
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
          expressionRestorerModel,
          lipSyncerModel,
          onProgress: (progress) => sendProgress(2, 'running', progress),
        };

        const faceswapResult = await runFaceSwap(faceswapOptions);

        if (!faceswapResult.success) {
          finish({
            success: false,
            error: `Face swap failed: ${faceswapResult.error}`,
            errorCode: faceswapResult.errorCode,
          });
          return;
        }

        console.log('[API] Face swap terminé');
        sendProgress(2, 'completed');

        // Étape 3: Reconvertir MP4 en GIF pour l'affichage
        sendProgress(3, 'running');
        console.log('[API] Conversion MP4 → GIF...');

        const mp4ToGifResult = await mp4ToGif({
          inputPath: outputMp4Path,
          outputPath: outputGifPath,
          fps: 10,
          maxWidth: 320,
        });

        if (!mp4ToGifResult.success) {
          finish({
            success: false,
            error: `MP4→GIF conversion failed: ${mp4ToGifResult.error}`,
            errorCode: mp4ToGifResult.errorCode,
          });
          return;
        }

        console.log('[API] Conversion terminée');
        sendProgress(3, 'completed');

        pruneResultsFiles();

        // Construire l'URL publique pour le résultat
        const resultFileName = path.basename(outputGifPath);
        const resultUrl = `/api/results/${resultFileName}`;

        finish({ success: true, outputPath: resultUrl });
      } catch (error) {
        console.error('[API] Erreur:', error);
        finish({
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
