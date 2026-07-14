'use client';

import { useEffect, useState } from 'react';
import {
  DownloadSimpleIcon as DownloadSimple,
  ImagesIcon as Images,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';
import { downloadFile } from '../lib/download';

interface ResultHistoryItem {
  filename: string;
  url: string;
  timestamp: number;
}

interface ResultsHistoryProps {
  /** Bump this value to trigger a refetch, e.g. right after a swap completes. */
  refreshSignal: number;
}

function isVideoFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.mp4');
}

export function ResultsHistory({ refreshSignal }: ResultsHistoryProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<ResultHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (typeof window === 'undefined') return;

      const electronAPI = window.electronAPI;
      if (electronAPI && typeof electronAPI.getResultsHistory === 'function') {
        try {
          const res = await electronAPI.getResultsHistory();
          if (!cancelled && res.success && res.history) {
            setHistory(res.history);
          }
        } catch (e) {
          console.error('Failed to load results history from Electron', e);
        }
        return;
      }

      try {
        const res = await fetch('/api/results-history');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.success && data.history) {
            setHistory(data.history);
          }
        }
      } catch (e) {
        console.error('Failed to load results history from Web API', e);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const handleDownload = (item: ResultHistoryItem) => {
    void downloadFile(item.url, item.filename);
  };

  const handleDelete = async (item: ResultHistoryItem) => {
    const electronAPI = window.electronAPI;
    try {
      if (electronAPI && typeof electronAPI.deleteResult === 'function') {
        const res = await electronAPI.deleteResult(item.filename);
        if (!res.success) return;
      } else {
        const res = await fetch(`/api/results/${encodeURIComponent(item.filename)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
      }
      setHistory((prev) => prev.filter((h) => h.filename !== item.filename));
    } catch (e) {
      console.error('Failed to delete result', e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t('resultsHistory.clearAllConfirm'))) return;

    const electronAPI = window.electronAPI;
    try {
      if (electronAPI && typeof electronAPI.clearResultsHistory === 'function') {
        const res = await electronAPI.clearResultsHistory();
        if (!res.success) return;
      } else {
        const res = await fetch('/api/results-history', { method: 'DELETE' });
        if (!res.ok) return;
      }
      setHistory([]);
    } catch (e) {
      console.error('Failed to clear results history', e);
    }
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg">
          <Images size={16} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {t('resultsHistory.title')}
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            {t('resultsHistory.subtitle')}
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            type="button"
            title={t('resultsHistory.clearAll')}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash size={12} />
            {t('resultsHistory.clearAll')}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/30 rounded-xl border border-dashed border-[var(--border-subtle)]">
          {t('resultsHistory.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
          {history.map((item) => (
            <div
              key={item.filename}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-[var(--border-color)] hover:border-[var(--emerald-main)] transition-all duration-300 group bg-[var(--bg-secondary)] flex items-center justify-center"
            >
              {isVideoFile(item.filename) ? (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`Result ${item.filename}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <button
                onClick={() => handleDownload(item)}
                type="button"
                title={t('resultsHistory.downloadTitle')}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <DownloadSimple size={18} className="text-white" weight="bold" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(item);
                }}
                type="button"
                title={t('resultsHistory.deleteTitle')}
                className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all cursor-pointer"
              >
                <Trash size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
