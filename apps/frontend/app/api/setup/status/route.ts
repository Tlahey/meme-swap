import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { checkDiskSpace } from '@meme-swap/installer-core';
import { getFaceFusionDir } from '@meme-swap/faceswap-core';
import { isFfmpegInstalled } from '@meme-swap/video-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/setup/status
 * Reports whether FaceFusion (clone + venv) and FFmpeg are installed, plus disk
 * space info for the volume that will host ~/.meme-swap — fetched once on mount
 * by SetupGate (apps/frontend/app/page.tsx) before the wizard renders, so the
 * wizard can show a size/time estimate and a low-space warning without a second
 * round-trip.
 */
export async function GET() {
  const faceFusionDir = getFaceFusionDir();
  const isCloned = fs.existsSync(path.join(faceFusionDir, 'facefusion.py'));
  const hasVenv = fs.existsSync(path.join(faceFusionDir, 'venv'));
  const hasFfmpeg = isFfmpegInstalled();

  const installed = isCloned && hasVenv && hasFfmpeg;
  const diskSpace = checkDiskSpace();

  return NextResponse.json({ installed, diskSpace });
}
