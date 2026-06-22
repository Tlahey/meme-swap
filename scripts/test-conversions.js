#!/usr/bin/env node

/**
 * Test de conversion GIF ↔ MP4
 * Ce script teste uniquement les fonctionnalités de conversion
 */

import { gifToMp4, mp4ToGif } from '../packages/video-processor/dist/index.js';
import path from 'node:path';

async function test() {
  console.log('🧪 Test des conversions GIF ↔ MP4');
  console.log('==================================\n');

  const testDir = './test-assets';

  try {
    // Test 1: GIF → MP4
    console.log('1️⃣ Test: GIF → MP4');
    const gifInput = path.join(testDir, 'test-target.gif');
    const mp4Output = path.join(testDir, 'test-converted.mp4');

    console.log(`   Input:  ${gifInput}`);
    console.log(`   Output: ${mp4Output}`);

    const gifToMp4Result = await gifToMp4({
      inputPath: gifInput,
      outputPath: mp4Output,
    });

    if (gifToMp4Result.success) {
      console.log('   ✅ Conversion GIF → MP4 réussie!\n');
    } else {
      console.error(`   ❌ Erreur: ${gifToMp4Result.error}\n`);
      process.exit(1);
    }

    // Test 2: MP4 → GIF
    console.log('2️⃣ Test: MP4 → GIF');
    const mp4Input = path.join(testDir, 'test-video.mp4');
    const gifOutput = path.join(testDir, 'test-converted.gif');

    console.log(`   Input:  ${mp4Input}`);
    console.log(`   Output: ${gifOutput}`);

    const mp4ToGifResult = await mp4ToGif({
      inputPath: mp4Input,
      outputPath: gifOutput,
      fps: 5,
      maxWidth: 320,
    });

    if (mp4ToGifResult.success) {
      console.log('   ✅ Conversion MP4 → GIF réussie!\n');
    } else {
      console.error(`   ❌ Erreur: ${mp4ToGifResult.error}\n`);
      process.exit(1);
    }

    console.log('✅ Tous les tests sont passés!');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

test();
