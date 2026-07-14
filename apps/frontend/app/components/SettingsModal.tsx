'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XIcon as X,
  KeyIcon as Key,
  InfoIcon as Info,
  CheckIcon as Check,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const { t } = useTranslation();
  const [giphyKey, setGiphyKey] = useState('');
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load key from localStorage on mount/open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedKey = window.localStorage.getItem('giphy_api_key') || '';
      setGiphyKey(savedKey);
      setShowSavedNotification(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('giphy_api_key', giphyKey.trim());
      onSave(giphyKey.trim());
      setShowSavedNotification(true);
      setTimeout(() => {
        setShowSavedNotification(false);
        onClose();
      }, 1200);
    }
  };

  const handleClear = () => {
    setGiphyKey('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              width: '850px',
            }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl rounded-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] w-full max-w-[850px] z-10"
          >
            {/* Left Side: Settings Fields (50%) */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto border-b md:border-b-0 border-[var(--border-color)]">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Key size={20} className="text-[var(--emerald-main)]" />
                    {t('settings.title')}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors md:hidden"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form Group */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      {t('settings.giphyKeyLabel')}
                    </label>

                    <div className="relative flex items-center">
                      <input
                        ref={inputRef}
                        type="password"
                        value={giphyKey}
                        onChange={(e) => setGiphyKey(e.target.value)}
                        placeholder={t('settings.giphyKeyPlaceholder')}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--emerald-main)] text-sm text-[var(--text-primary)] transition-all font-mono placeholder:font-sans"
                      />
                      {giphyKey && (
                        <button
                          onClick={handleClear}
                          className="absolute right-3 p-0.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          title="Effacer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Laissez vide pour désactiver le moteur de recherche et revenir à
                      l&apos;importateur classique.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-[var(--emerald-main)] hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-emerald-500/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  {showSavedNotification ? (
                    <>
                      <Check size={14} weight="bold" />
                      {t('settings.savedSuccess')}
                    </>
                  ) : (
                    t('settings.save')
                  )}
                </button>
              </div>
            </div>

            {/* Right Side: Instructional Panel (50%) */}
            <div className="w-full md:w-1/2 border-t md:border-t-0 md:border-l border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-6 overflow-y-auto flex flex-col justify-between relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors hidden md:block"
                title="Fermer"
              >
                <X size={18} />
              </button>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Info size={16} className="text-[var(--emerald-main)]" />
                  {t('settings.helpTitle')}
                </h3>

                <div className="text-xs text-[var(--text-secondary)] space-y-2.5 leading-relaxed">
                  <p>
                    {t('settings.helpStep1')}{' '}
                    <a
                      href="https://developers.giphy.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--emerald-text)] font-semibold underline underline-offset-2 hover:text-[var(--emerald-main)]"
                    >
                      developers.giphy.com
                    </a>
                  </p>
                  <p>{t('settings.helpStep2')}</p>
                  <p>{t('settings.helpStep3')}</p>
                  <p>{t('settings.helpStep4')}</p>
                  <p>{t('settings.helpStep5')}</p>
                  <p>{t('settings.helpStep6')}</p>
                  <p>{t('settings.helpStep7')}</p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--border-color)]/60">
                <p className="text-[9px] leading-relaxed text-[var(--text-muted)] italic">
                  {t('settings.helpDisclaimer')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
