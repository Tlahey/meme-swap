import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const RESULTS_DIR = path.join(os.homedir(), '.meme-swap', 'process', 'results');

/**
 * Doit rester cohérent avec RESULTS_HISTORY_LIMIT dans app/api/faceswap/route.ts
 * (la purge y est déclenchée après chaque swap réussi ; celle-ci n'est qu'un
 * filet de sécurité si des fichiers s'accumulent en dehors de ce flux).
 */
const RESULTS_HISTORY_LIMIT = 20;

function ensureResultsDirectory(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function pruneResultsFiles(): void {
  ensureResultsDirectory();
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
        console.error(
          `[API Results History] Failed to delete old result file: ${info.name}`,
          error,
        );
      }
    }
  }
}

function getResultsHistoryList() {
  ensureResultsDirectory();
  pruneResultsFiles();
  const files = fs.readdirSync(RESULTS_DIR);
  const fileInfos = files
    .map((name) => {
      const filePath = path.join(RESULTS_DIR, name);
      try {
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          url: `/api/results/${name}`,
          timestamp: stats.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((info): info is { filename: string; url: string; timestamp: number } => info !== null);

  fileInfos.sort((a, b) => b.timestamp - a.timestamp);
  return fileInfos;
}

export async function GET() {
  try {
    const history = getResultsHistoryList();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('[API Results History] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}

/**
 * Vide entièrement l'historique des résultats (DELETE /api/results-history)
 */
export async function DELETE() {
  try {
    ensureResultsDirectory();
    const files = fs.readdirSync(RESULTS_DIR);
    for (const name of files) {
      try {
        fs.unlinkSync(path.join(RESULTS_DIR, name));
      } catch (error) {
        console.error(`[API Results History] Failed to delete result file: ${name}`, error);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Results History] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
