import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HISTORY_DIR = path.join(os.homedir(), '.meme-swap', 'source-history');

function ensureHistoryDirectory(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function pruneHistoryFiles(): void {
  ensureHistoryDirectory();
  const files = fs.readdirSync(HISTORY_DIR);
  const fileInfos = files
    .map((name) => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return { name, mtime: stats.mtimeMs };
      } catch (e) {
        return null;
      }
    })
    .filter((info): info is { name: string; mtime: number } => info !== null);

  // Trier par mtime décroissant (plus récent en premier)
  fileInfos.sort((a, b) => b.mtime - a.mtime);

  if (fileInfos.length > 5) {
    const toDelete = fileInfos.slice(5);
    for (const info of toDelete) {
      try {
        fs.unlinkSync(path.join(HISTORY_DIR, info.name));
      } catch (e) {
        console.error(`Failed to delete old history file: ${info.name}`, e);
      }
    }
  }
}

function getHistoryList() {
  ensureHistoryDirectory();
  pruneHistoryFiles();
  const files = fs.readdirSync(HISTORY_DIR);
  const fileInfos = files
    .map((name) => {
      const filePath = path.join(HISTORY_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          url: `/api/source-history/${name}`,
          timestamp: stats.mtimeMs,
        };
      } catch (e) {
        return null;
      }
    })
    .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

  fileInfos.sort((a, b) => b.timestamp - a.timestamp);
  return fileInfos;
}

export async function GET() {
  try {
    const history = getHistoryList();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('[API History] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureHistoryDirectory();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const cleanExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const newFileName = `face-${timestamp}-${random}${cleanExt}`;
    const destPath = path.join(HISTORY_DIR, newFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    // Mettre à jour les timestamps
    const now = new Date();
    fs.utimesSync(destPath, now, now);

    const history = getHistoryList();

    return NextResponse.json({
      success: true,
      savedFilename: newFileName,
      history,
    });
  } catch (error) {
    console.error('[API History] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
