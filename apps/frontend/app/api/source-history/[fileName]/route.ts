import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HISTORY_DIR = path.join(os.homedir(), '.meme-swap', 'source-history');

/**
 * Serve les fichiers de l'historique des visages source (GET /api/source-history/:fileName)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  if (!fileName) {
    return NextResponse.json({ error: 'Nom de fichier manquant' }, { status: 404 });
  }

  // Protection contre le path traversal
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 });
  }

  const filePath = path.join(HISTORY_DIR, fileName);

  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(HISTORY_DIR))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
  }

  // Déterminer le type MIME
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
