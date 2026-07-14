import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getFaceFusionDir } from '@meme-swap/faceswap-core';
import { isFfmpegInstalled } from '@meme-swap/video-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/setup/status
 * Reports whether FaceFusion (clone + venv) and FFmpeg are installed.
 */
export async function GET() {
  const faceFusionDir = getFaceFusionDir();
  const isCloned = fs.existsSync(path.join(faceFusionDir, 'facefusion.py'));
  const hasVenv = fs.existsSync(path.join(faceFusionDir, 'venv'));
  const hasFfmpeg = isFfmpegInstalled();

  const installed = isCloned && hasVenv && hasFfmpeg;

  return NextResponse.json({ installed });
}
