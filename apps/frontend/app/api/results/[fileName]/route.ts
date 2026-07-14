import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Configuration des chemins
const PROCESS_DIR = path.join(os.homedir(), '.meme-swap', 'process');
const RESULTS_DIR = path.join(PROCESS_DIR, 'results');

/**
 * Résout et valide le chemin d'un fichier de résultat à partir de son nom.
 * Retourne le chemin absolu, ou une NextResponse d'erreur si le nom est
 * manquant/invalide, tente un path traversal, ou que le fichier n'existe pas.
 */
function resolveResultFilePath(fileName: string | undefined): string | NextResponse {
  if (!fileName) {
    return NextResponse.json({ error: 'Nom de fichier manquant' }, { status: 404 });
  }

  // Protection contre le path traversal : interdire les caractères de navigation
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 });
  }

  const filePath = path.join(RESULTS_DIR, fileName);

  // Vérification supplémentaire : le chemin résolu doit rester dans RESULTS_DIR
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(RESULTS_DIR))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
  }

  return filePath;
}

/**
 * Serve les fichiers de résultat (GET /api/results/:fileName)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  const filePath = resolveResultFilePath(fileName);
  if (filePath instanceof NextResponse) {
    return filePath;
  }

  // Déterminer le type MIME
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
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
 * Supprime un fichier de résultat (DELETE /api/results/:fileName)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  const filePath = resolveResultFilePath(fileName);
  if (filePath instanceof NextResponse) {
    return filePath;
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API Results] Failed to delete result file: ${fileName}`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
