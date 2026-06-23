import { z } from 'zod';
import { runFaceSwap, FaceswapOptions } from '@meme-swap/faceswap-core';
import {
  gifToMp4,
  mp4ToGif,
  ConversionOptions,
} from '@meme-swap/video-processor';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FaceswapToolSchema = z.object({
  sourceImagePath: z
    .string()
    .describe(
      'Path to the source image containing the face to swap (the source / face / visage)',
    ),
  targetMediaPath: z
    .string()
    .describe(
      'Path to the target image or video (GIF/MP4) (the target / target media / target GIF)',
    ),
  outputPath: z.string().describe('Path where the output file should be saved'),
  executionProviders: z
    .array(z.string())
    .default(['coreml', 'cpu'])
    .describe('Execution providers for FaceFusion (coreml, cpu, cuda)'),
  threadCount: z
    .number()
    .default(4)
    .describe('Number of threads for processing'),
  faceSelectorMode: z
    .string()
    .optional()
    .describe('Face selector mode (reference, many, one)'),
  faceMaskBlend: z
    .number()
    .optional()
    .describe('Blend ratio for the face mask (0-100)'),
  faceSwapperModel: z
    .string()
    .optional()
    .describe('Face swapper model to use (e.g. inswapper_128_fp16)'),
  faceEnhancerModel: z
    .string()
    .optional()
    .describe('Face enhancer model to use (e.g. codeformer)'),
  faceEnhancerBlend: z
    .number()
    .optional()
    .describe('Blend ratio for the face enhancer (0-100)'),
  frameEnhancerModel: z
    .string()
    .optional()
    .describe('Frame enhancer model to use (e.g. real_esrgan_x2)'),
  lipSyncerModel: z
    .string()
    .optional()
    .describe('Lip syncer model to use'),
  logLevel: z
    .enum(['debug', 'info', 'warning', 'error'])
    .default('info')
    .describe('Log level (debug, info, warning, error)'),
});

type FaceswapToolArgs = z.infer<typeof FaceswapToolSchema>;

// Working directory for temporary files
const PROCESS_DIR = path.join(os.homedir(), '.meme-swap', 'process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');

function ensureDirectories(): void {
  if (!fs.existsSync(PROCESS_DIR)) {
    fs.mkdirSync(PROCESS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      console.log('MCP: Temp directory cleared');
    } catch (error) {
      console.error('MCP: Failed to clear temp directory:', error);
    }
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupTempFiles(pattern?: string): void {
  if (!fs.existsSync(TEMP_DIR)) {
    return;
  }

  const files = fs.readdirSync(TEMP_DIR);
  for (const file of files) {
    if (!pattern || file.includes(pattern)) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`Cleaned up temp file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to clean up ${filePath}:`, error);
      }
    }
  }
}

async function convertIfNecessary(
  inputPath: string,
  outputPath: string,
  conversionType: 'gifToMp4' | 'mp4ToGif',
): Promise<string> {
  const extension = path.extname(inputPath).toLowerCase();

  if (conversionType === 'gifToMp4' && extension === '.gif') {
    const result = await gifToMp4({ inputPath, outputPath });
    if (!result.success) {
      throw new Error(`Failed to convert GIF to MP4: ${result.error}`);
    }
    return outputPath;
  }

  if (conversionType === 'mp4ToGif' && extension === '.mp4') {
    const result = await mp4ToGif({ inputPath, outputPath });
    if (!result.success) {
      throw new Error(`Failed to convert MP4 to GIF: ${result.error}`);
    }
    return outputPath;
  }

  // No conversion needed
  return inputPath;
}

export async function runFaceswapTool(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  try {
    // Validate arguments
    const validatedArgs = FaceswapToolSchema.parse(args);

    // Ensure directories exist
    ensureDirectories();
    cleanupTempDir();

    const {
      sourceImagePath,
      targetMediaPath,
      outputPath,
      executionProviders,
      threadCount,
      faceSelectorMode,
      faceMaskBlend,
      faceSwapperModel,
      faceEnhancerModel,
      faceEnhancerBlend,
      frameEnhancerModel,
      lipSyncerModel,
      logLevel,
    } = validatedArgs;

    console.log('Starting face swap operation...');
    console.log(`Source: ${sourceImagePath}`);
    console.log(`Target: ${targetMediaPath}`);
    console.log(`Output: ${outputPath}`);

    // Check if files exist
    if (!fs.existsSync(sourceImagePath)) {
      throw new Error(`Source image not found: ${sourceImagePath}`);
    }
    if (!fs.existsSync(targetMediaPath)) {
      throw new Error(`Target media not found: ${targetMediaPath}`);
    }

    // Create temp directory for intermediate files
    const filename = path.basename(
      targetMediaPath,
      path.extname(targetMediaPath),
    );
    const tempMp4Path = path.join(TEMP_DIR, `${filename}_temp.mp4`);
    const tempOutputMp4Path = path.join(TEMP_DIR, `${filename}_output.mp4`);

    let targetForFaceswap = targetMediaPath;
    let finalOutputPath = outputPath;

    // Convert GIF to MP4 if necessary
    if (targetMediaPath.toLowerCase().endsWith('.gif')) {
      console.log('Converting GIF to MP4 for face swap...');
      targetForFaceswap = await convertIfNecessary(
        targetMediaPath,
        tempMp4Path,
        'gifToMp4',
      );
    }

    // Run face swap
    const faceswapOptions: FaceswapOptions = {
      sourcePath: sourceImagePath,
      targetPath: targetForFaceswap,
      outputPath: tempOutputMp4Path,
      executionProviders: executionProviders as ('coreml' | 'cpu' | 'cuda')[],
      threadCount,
      faceSelectorMode,
      faceMaskBlend,
      faceSwapperModel,
      faceEnhancerModel,
      faceEnhancerBlend,
      frameEnhancerModel,
      lipSyncerModel,
      logLevel,
    };

    console.log('Running FaceFusion...');
    const result = await runFaceSwap(faceswapOptions);

    if (!result.success) {
      throw new Error(`Face swap failed: ${result.error}`);
    }

    // Convert back to GIF if original was GIF
    if (targetMediaPath.toLowerCase().endsWith('.gif')) {
      console.log('Converting result back to GIF...');
      const gifOutputPath = outputPath.replace(/\.mp4$/i, '.gif');
      finalOutputPath = gifOutputPath;

      const conversionResult = await mp4ToGif({
        inputPath: tempOutputMp4Path,
        outputPath: gifOutputPath,
      });

      if (!conversionResult.success) {
        throw new Error(
          `Failed to convert result to GIF: ${conversionResult.error}`,
        );
      }
    }

    // Cleanup temporary files
    cleanupTempFiles(filename);

    console.log('Face swap completed successfully!');
    console.log(`Output saved to: ${finalOutputPath}`);

    return {
      content: [
        {
          type: 'text',
          text:
            `✅ Face swap completed successfully!\n\n` +
            `Source: ${sourceImagePath}\n` +
            `Target: ${targetMediaPath}\n` +
            `Output: ${finalOutputPath}\n\n` +
            `Execution providers: ${executionProviders.join(', ')}\n` +
            `Threads: ${threadCount}\n` +
            `Face Selector Mode: ${faceSelectorMode || 'N/A'}\n` +
            `Face Mask Blend: ${faceMaskBlend !== undefined ? faceMaskBlend : 'N/A'}\n` +
            `Face Swapper Model: ${faceSwapperModel || 'N/A'}\n` +
            `Face Enhancer Model: ${faceEnhancerModel || 'N/A'}\n` +
            `Face Enhancer Blend: ${faceEnhancerBlend !== undefined ? faceEnhancerBlend : 'N/A'}\n` +
            `Frame Enhancer Model: ${frameEnhancerModel || 'N/A'}\n` +
            `Lip Syncer Model: ${lipSyncerModel || 'N/A'}\n` +
            `Log Level: ${logLevel}`,
        },
      ],
    };
  } catch (error) {
    console.error('Face swap error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Cleanup on error
    cleanupTempFiles();

    return {
      content: [
        {
          type: 'text',
          text: `❌ Face swap failed: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
