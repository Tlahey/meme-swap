#!/usr/bin/env node

/**
 * Script CLI pour tester le face swap
 *
 * Usage:
 *   pnpm test:faceswap --source <source-image> --target <target-media> --output <output-path>
 *
 * Exemple:
 *   pnpm test:faceswap --source ./test-assets/source.jpg --target ./test-assets/target.gif --output ./test-assets/output.mp4
 */

import { runFaceSwap } from '../packages/faceswap-core/dist/index.js';
import { gifToMp4, mp4ToGif } from '../packages/video-processor/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';

// Parsing des arguments
const args = process.argv.slice(2);
const sourceArg = args.find((arg) => arg.startsWith('--source='));
const targetArg = args.find((arg) => arg.startsWith('--target='));
const outputArg = args.find((arg) => arg.startsWith('--output='));
const providersArg = args.find((arg) => arg.startsWith('--providers='));

const sourcePath = sourceArg?.split('=')[1];
const targetPath = targetArg?.split('=')[1];
const outputPath = outputArg?.split('=')[1];
const providers = providersArg
  ? providersArg.split('=')[1].split(',')
  : ['coreml'];

if (!sourcePath || !targetPath || !outputPath) {
  console.error('❌ Arguments manquants');
  console.error('');
  console.error('Usage:');
  console.error(
    '  pnpm test:faceswap --source=<source-image> --target=<target-media> --output=<output-path>',
  );
  console.error('');
  console.error('Options:');
  console.error(
    '  --source=<path>    Image source avec le visage à transférer',
  );
  console.error('  --target=<path>    Média cible (GIF ou MP4)');
  console.error('  --output=<path>    Chemin de sortie pour le résultat');
  console.error(
    "  --providers=<list> Fournisseurs d'exécution (par défaut: coreml,cpu)",
  );
  console.error('');
  console.error('Exemple:');
  console.error(
    '  pnpm test:faceswap --source=./test-assets/source.jpg --target=./test-assets/target.gif --output=./test-assets/output.gif',
  );
  process.exit(1);
}

// Vérification des fichiers
if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Image source non trouvée: ${sourcePath}`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  console.error(`❌ Média cible non trouvé: ${targetPath}`);
  process.exit(1);
}

// Création des répertoires de travail
const PROCESS_DIR = path.join(process.cwd(), '.process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');

if (!fs.existsSync(PROCESS_DIR)) {
  fs.mkdirSync(PROCESS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Nettoyage des fichiers temporaires
function cleanupTempFiles() {
  if (!fs.existsSync(TEMP_DIR)) {
    return;
  }

  const files = fs.readdirSync(TEMP_DIR);
  for (const file of files) {
    const filePath = path.join(TEMP_DIR, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 Nettoyage: ${filePath}`);
    } catch (error) {
      console.error(`Erreur de nettoyage ${filePath}:`, error);
    }
  }
}

async function main() {
  console.log('🎭 Face Swap CLI');
  console.log('================');
  console.log(`Source: ${sourcePath}`);
  console.log(`Target: ${targetPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Providers: ${providers.join(', ')}`);
  console.log('');

  try {
    // Conversion GIF → MP4 si nécessaire
    let targetForFaceswap = targetPath;
    const tempMp4Path = path.join(
      TEMP_DIR,
      `${path.basename(targetPath, path.extname(targetPath))}_temp.mp4`,
    );

    if (targetPath.toLowerCase().endsWith('.gif')) {
      console.log('🔄 Conversion GIF → MP4...');
      const conversionResult = await gifToMp4({
        inputPath: targetPath,
        outputPath: tempMp4Path,
      });

      if (!conversionResult.success) {
        throw new Error(`Échec de la conversion: ${conversionResult.error}`);
      }
      targetForFaceswap = tempMp4Path;
      console.log('✅ Conversion terminée');
    }

    // Exécution du face swap
    console.log('🤖 Exécution de FaceFusion...');
    const result = await runFaceSwap({
      sourcePath,
      targetPath: targetForFaceswap,
      outputPath: tempMp4Path, // On utilise un fichier temp pour le résultat MP4
      executionProviders: providers,
      threadCount: 4,
      logLevel: 'info',
    });

    if (!result.success) {
      throw new Error(`Échec du face swap: ${result.error}`);
    }

    // Conversion MP4 → GIF si la cible était un GIF
    if (targetPath.toLowerCase().endsWith('.gif')) {
      const outputGifPath = outputPath.replace(/\.mp4$/i, '.gif');
      console.log('🔄 Conversion MP4 → GIF...');
      const conversionResult = await mp4ToGif({
        inputPath: tempMp4Path,
        outputPath: outputGifPath,
      });

      if (!conversionResult.success) {
        throw new Error(
          `Échec de la conversion vers GIF: ${conversionResult.error}`,
        );
      }
      console.log('✅ Conversion terminée');
      console.log(`📁 Résultat final: ${outputGifPath}`);

      // Nettoyage des fichiers temporaires
      console.log('🧹 Nettoyage des fichiers temporaires...');
      cleanupTempFiles();
      console.log('✅ Nettoyage terminé');

      console.log('');
      console.log('✅ Face swap terminé avec succès !');
      console.log(`📦 Fichier généré: ${outputGifPath}`);
    } else {
      // Pour MP4, on déplace le fichier temp vers la sortie
      fs.renameSync(tempMp4Path, outputPath);
      console.log(`📁 Résultat final: ${outputPath}`);

      // Nettoyage des fichiers temporaires
      console.log('🧹 Nettoyage des fichiers temporaires...');
      cleanupTempFiles();
      console.log('✅ Nettoyage terminé');

      console.log('');
      console.log('✅ Face swap terminé avec succès !');
      console.log(`📦 Fichier généré: ${outputPath}`);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Erreur:', error instanceof Error ? error.message : error);

    // Nettoyage en cas d'erreur
    console.log('🧹 Nettoyage des fichiers temporaires...');
    cleanupTempFiles();

    process.exit(1);
  }
}

main();
