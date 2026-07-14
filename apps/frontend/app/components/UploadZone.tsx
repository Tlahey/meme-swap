'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  UploadSimpleIcon as UploadSimple,
  ImageIcon as ImageIconComponent,
  VideoCameraIcon as VideoCamera,
  TrashIcon as Trash,
  FileIcon,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

interface UploadZoneProps {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File) => void;
  onRemove: () => void;
  description: string;
  type: 'image' | 'video';
  isProcessing?: boolean;
}

export function UploadZone({
  id,
  label,
  accept,
  file,
  previewUrl,
  onChange,
  onRemove,
  description,
  type,
  isProcessing = false,
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (isProcessing || isDownloading) return; // Block drops during processing/downloading

    // 1. Check if dropped from GiphySearch (JSON payload)
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData && type === 'video') {
      try {
        const { gifUrl, title } = JSON.parse(jsonData);
        if (gifUrl) {
          setIsDownloading(true);
          const response = await fetch(gifUrl);
          if (!response.ok) throw new Error('Fetch failed');
          const blob = await response.blob();
          const cleanTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'giphy';
          const file = new File([blob], `${cleanTitle}.gif`, { type: 'image/gif' });
          onChange(file);
          return;
        }
      } catch (err) {
        console.error('Failed to resolve dropped Giphy GIF JSON:', err);
      } finally {
        setIsDownloading(false);
      }
    }

    // 2. Check if dropped a direct URL
    const textUrl = e.dataTransfer.getData('text/plain');
    if (textUrl && textUrl.startsWith('http') && type === 'video') {
      try {
        setIsDownloading(true);
        const response = await fetch(textUrl);
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        const file = new File([blob], 'dropped_giphy.gif', { type: 'image/gif' });
        onChange(file);
        return;
      } catch (err) {
        console.error('Failed to resolve dropped Giphy GIF URL:', err);
      } finally {
        setIsDownloading(false);
      }
    }

    // 3. Normal local file drop
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      // Validate basic format before assigning
      const fileType = droppedFile.type;
      if (type === 'image' && !fileType.startsWith('image/')) {
        alert(t('upload.invalidImage'));
        return;
      }
      if (type === 'video' && !fileType.includes('gif') && !fileType.includes('mp4')) {
        alert(t('upload.invalidVideo'));
        return;
      }
      onChange(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onChange(selectedFile);
    }
  };

  const onButtonClick = () => {
    if (isProcessing || isDownloading) return;
    inputRef.current?.click();
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Label inside the visual flow, not overflowing */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        {file && (
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {file.name.length > 20
              ? `${file.name.substring(0, 12)}...${file.name.split('.').pop()}`
              : file.name}{' '}
            · {formatBytes(file.size)}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        id={id}
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={isProcessing}
      />

      <motion.div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={file ? undefined : onButtonClick}
        animate={{
          borderColor: isDragActive ? 'var(--emerald-main)' : 'var(--border-color)',
          backgroundColor: isDragActive ? 'var(--emerald-bg)' : 'var(--bg-secondary)',
          scale: shouldReduceMotion ? 1 : isDragActive ? 1.01 : 1,
        }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className={`relative flex flex-col items-center justify-center border border-dashed rounded-xl overflow-hidden transition-colors ${
          file
            ? 'cursor-default p-3'
            : isProcessing || isDownloading
              ? 'cursor-not-allowed opacity-50 p-5 min-h-[160px]'
              : 'hover:border-[var(--emerald-main)]/50 hover:bg-[var(--bg-tertiary)]/30 group cursor-pointer p-5 min-h-[160px]'
        } shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]`}
      >
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="empty"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-2.5"
            >
              {isDownloading ? (
                <div className="flex flex-col items-center gap-2 text-[var(--emerald-text)] animate-pulse">
                  <div className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--emerald-main)]/30 text-[var(--emerald-main)] shadow-[0_0_15px_var(--emerald-bg)]">
                    <VideoCamera size={24} className="animate-bounce" />
                  </div>
                  <p className="text-xs font-semibold">
                    {t('giphySearch.loadingGif') || 'Téléchargement...'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] group-hover:text-[var(--emerald-text)] group-hover:border-[var(--emerald-main)]/30 group-hover:shadow-[0_0_15px_var(--emerald-bg)] transition-all duration-300">
                    {type === 'image' ? (
                      <ImageIconComponent size={24} weight="regular" />
                    ) : (
                      <VideoCamera size={24} weight="regular" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t('upload.dragDrop')}{' '}
                      <span className="text-[var(--emerald-text)] font-medium underline underline-offset-4 decoration-[var(--emerald-main)]/40 group-hover:decoration-[var(--emerald-main)]">
                        {t('upload.browse')}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[220px]">
                      {description}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full flex items-center justify-center"
            >
              {/* Preview container — taller for better visibility */}
              <div className="relative w-full rounded-lg overflow-hidden flex items-center justify-center bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] aspect-video max-h-52">
                {previewUrl ? (
                  type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`${t('upload.preview')} : ${file.name}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : file.name.endsWith('.mp4') ? (
                    <video
                      src={previewUrl}
                      className="max-h-full max-w-full object-contain"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`${t('upload.preview')} : ${file.name}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  )
                ) : (
                  <div className="p-6 flex flex-col items-center gap-2 text-[var(--text-muted)]">
                    <FileIcon size={28} />
                    <span className="text-xs font-mono">{file.name}</span>
                  </div>
                )}

                {/* Laser scan animation overlay */}
                {isProcessing && type === 'image' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden bg-emerald-950/10">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent_80%)] animate-pulse" />
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                      initial={{ top: '0%' }}
                      animate={{ top: '100%' }}
                      transition={{
                        repeat: Infinity,
                        repeatType: 'reverse',
                        duration: 1.8,
                        ease: 'easeInOut',
                      }}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-400 text-[9px] font-semibold uppercase tracking-wider animate-pulse">
                      {t('upload.analyzing')}
                    </div>
                  </div>
                )}

                {/* Floating delete button */}
                {!isProcessing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    id={`${id}-delete-btn`}
                    className="absolute top-2 right-2 p-1.5 bg-[var(--bg-primary)] hover:bg-red-500 text-[var(--text-secondary)] hover:text-white rounded-lg border border-[var(--border-color)] hover:border-red-500/50 transition-all backdrop-blur-sm cursor-pointer active:scale-90"
                    title={t('upload.deleteFile')}
                  >
                    <Trash size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
