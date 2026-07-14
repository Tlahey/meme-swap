'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowSquareOutIcon as ArrowSquareOut, XIcon as X } from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

const DISMISSED_VERSION_STORAGE_KEY = 'meme-swap:dismissed-update-version';

interface UpdateInfo {
  version: string;
  url: string;
}

/**
 * Electron-only "check + notify" update banner. The app isn't code-signed/
 * notarized yet, so a real silent auto-updater (electron-updater/
 * Squirrel.Mac) is off the table for now — the main process just polls the
 * latest GitHub release (see checkForUpdate in apps/desktop/src/main.ts) and
 * pushes an `update-available` IPC event here when a newer version exists.
 *
 * Renders nothing on the web app (no installable version concept there) and
 * nothing until an update event actually arrives.
 */
export function UpdateBanner() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(DISMISSED_VERSION_STORAGE_KEY),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || typeof electronAPI.onUpdateAvailable !== 'function') return;

    electronAPI.onUpdateAvailable((_event: any, data: { version: string; url: string }) => {
      setUpdateInfo(data);
    });
    // Note: unlike onFaceswapProgress, onUpdateAvailable doesn't return an
    // unsubscribe function — acceptable here since it fires at most a
    // couple of times per session (once at startup, then every 6h).
  }, []);

  const hasUpdateApi =
    typeof window !== 'undefined' &&
    typeof (window as any).electronAPI?.onUpdateAvailable === 'function';

  if (!hasUpdateApi || !updateInfo || updateInfo.version === dismissedVersion) {
    return null;
  }

  const handleOpenRelease = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.openExternalUrl === 'function') {
      electronAPI.openExternalUrl(updateInfo.url);
    }
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, updateInfo.version);
    setDismissedVersion(updateInfo.version);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 right-4 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-auto"
        role="status"
      >
        <div className="flex items-start gap-3 bg-[var(--bg-primary)] border border-[var(--emerald-border)] shadow-lg rounded-2xl p-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {t('updateBanner.title')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {t('updateBanner.message', { version: updateInfo.version })}
            </p>
            <button
              onClick={handleOpenRelease}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] hover:bg-[var(--emerald-border)]/40 text-[var(--emerald-text)] rounded-lg text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
            >
              <ArrowSquareOut size={14} weight="bold" />
              {t('updateBanner.downloadButton')}
            </button>
          </div>
          <button
            onClick={handleDismiss}
            aria-label={t('updateBanner.dismiss')}
            className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
