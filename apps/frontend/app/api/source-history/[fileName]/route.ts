import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HISTORY_DIR = path.join(os.homedir(), '.meme-swap', 'source-history');

/**
 * Résout et valide le chemin d'un fichier de l'historique à partir de son nom.
 * Retourne le chemin absolu, ou une NextResponse d'erreur si le nom est
 * manquant/invalide, tente un path traversal, ou si le fichier n'existe pas.
 */
function resolveHistoryFilePath(fileName: string | undefined): string | NextResponse {
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

  return filePath;
}

/**
 * Serve les fichiers de l'historique des visages source (GET /api/source-history/:fileName)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  const filePath = resolveHistoryFilePath(fileName);
  if (filePath instanceof NextResponse) {
    return filePath;
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

/**
 * Supprime un visage de l'historique (DELETE /api/source-history/:fileName)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  const filePath = resolveHistoryFilePath(fileName);
  if (filePath instanceof NextResponse) {
    return filePath;
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API History] Failed to delete history file: ${fileName}`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
