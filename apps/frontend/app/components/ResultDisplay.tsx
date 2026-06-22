'use client';

import React, { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  DownloadSimpleIcon as DownloadSimple,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ColumnsIcon as Columns,
  SquareIcon as Square,
  ArrowsLeftRightIcon as ArrowsLeftRight,
} from '@phosphor-icons/react';

interface ResultDisplayProps {
  originalUrl: string | null;
  resultUrl: string;
  isMp4: boolean;
  onReset: () => void;
}

export function ResultDisplay({ originalUrl, resultUrl, isMp4, onReset }: ResultDisplayProps) {
  const [layoutMode, setLayoutMode] = useState<'split-slider' | 'side-by-side' | 'single-swapped'>('split-slider');
  const [activeTab, setActiveTab] = useState<'original' | 'result'>('result');
  const shouldReduceMotion = useReducedMotion();

  // Split-slider state
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateSlider(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSlider(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const updateSlider = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faceswap-result.${isMp4 ? 'mp4' : 'gif'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file', err);
      // Fallback
      window.open(resultUrl, '_blank');
    }
  };

  /**
   * Renders a media element (image or video) sized to fill its container exactly.
   * Both layers in the slider use the same absolute-fill + object-contain approach
   * so they are always pixel-perfect aligned regardless of their natural dimensions.
   */
  const renderMediaFill = (src: string, alt: string, dimmed = false) => {
    const cls = `absolute inset-0 w-full h-full object-contain pointer-events-none select-none${dimmed ? ' opacity-55' : ''}`;
    if (isMp4) {
      return (
        <video
          src={src}
          className={cls}
          controls={false}
          muted
          loop
          autoPlay
          playsInline
        />
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        className={cls}
        draggable={false}
      />
    );
  };

  /**
   * For side-by-side / focus modes where we don't need absolute fill.
   */
  const renderMedia = (src: string, alt: string) => {
    if (isMp4) {
      return (
        <video
          src={src}
          className="max-h-full max-w-full object-contain pointer-events-none select-none"
          controls={false}
          muted
          loop
          autoPlay
          playsInline
        />
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain pointer-events-none select-none"
        draggable={false}
      />
    );
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 backdrop-blur-md space-y-5 shadow-sm">
      {/* Header and Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Résultat final
        </h3>

        {/* Layout Mode selector */}
        <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)] shrink-0">
          <button
            onClick={() => setLayoutMode('split-slider')}
            id="layout-slider-btn"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer active:scale-95 ${
              layoutMode === 'split-slider'
                ? 'bg-[var(--bg-tertiary)] text-[var(--emerald-text)] font-semibold border border-[var(--border-color)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <ArrowsLeftRight size={13} />
            Glissant
          </button>
          <button
            onClick={() => setLayoutMode('side-by-side')}
            id="layout-side-by-side-btn"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer active:scale-95 ${
              layoutMode === 'side-by-side'
                ? 'bg-[var(--bg-tertiary)] text-[var(--emerald-text)] font-semibold border border-[var(--border-color)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Columns size={13} />
            Côte à côte
          </button>
          <button
            onClick={() => setLayoutMode('single-swapped')}
            id="layout-focus-btn"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer active:scale-95 ${
              layoutMode === 'single-swapped'
                ? 'bg-[var(--bg-tertiary)] text-[var(--emerald-text)] font-semibold border border-[var(--border-color)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Square size={13} />
            Focus
          </button>
        </div>
      </div>

      {/* Media comparison area */}
      <div className="w-full">
        {layoutMode === 'split-slider' ? (
          <div className="space-y-2">
            {/*
             * The slider container has a fixed aspect ratio.
             * Both the original and the result are rendered with `absolute inset-0 object-contain`
             * so they occupy the exact same bounding box — no size mismatch is possible.
             */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`relative aspect-video w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden cursor-ew-resize select-none touch-none ${
                isDragging ? 'active:cursor-ew-resize' : ''
              }`}
            >
              {/* Bottom Layer: Original Media — full-container, dimmed */}
              {originalUrl ? (
                renderMediaFill(originalUrl, 'Original', true)
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-muted)]">
                  Non disponible
                </span>
              )}

              {/* Top Layer: Swapped Result — same full-container sizing, clipped by slider */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                }}
              >
                {renderMediaFill(resultUrl, 'Face Swapped')}
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[var(--emerald-main)] shadow-[0_0_10px_rgba(16,185,129,0.5)] pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-[var(--bg-primary)] border-2 border-[var(--emerald-main)] rounded-full flex items-center justify-center text-[var(--emerald-text)] shadow-lg pointer-events-none">
                  <ArrowsLeftRight size={12} weight="bold" />
                </div>
              </div>

              {/* Top-left label - Swapped */}
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] rounded-full text-[var(--emerald-text)] text-[10px] font-semibold tracking-wider uppercase pointer-events-none backdrop-blur-sm">
                Swapped
              </div>

              {/* Top-right label - Original */}
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-[var(--bg-tertiary)]/80 border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] text-[10px] font-semibold tracking-wider uppercase pointer-events-none backdrop-blur-sm">
                Original
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              Faites glisser le curseur pour comparer l'original et le résultat.
            </p>
          </div>
        ) : layoutMode === 'side-by-side' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Original
              </span>
              <div className="relative aspect-video bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden flex items-center justify-center">
                {originalUrl ? (
                  renderMedia(originalUrl, 'Média original')
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">Non disponible</span>
                )}
              </div>
            </div>

            {/* Result */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--emerald-text)]">
                Face Swapped
              </span>
              <div className="relative aspect-video bg-[var(--bg-primary)] border border-[var(--emerald-border)] rounded-lg overflow-hidden flex items-center justify-center shadow-[0_0_24px_var(--emerald-bg)]">
                {renderMedia(resultUrl, 'Résultat face-swappé')}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Tabs selector */}
            <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-color)] w-fit">
              <button
                onClick={() => setActiveTab('original')}
                id="tab-original-btn"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  activeTab === 'original'
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setActiveTab('result')}
                id="tab-result-btn"
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  activeTab === 'result'
                    ? 'bg-[var(--bg-tertiary)] text-[var(--emerald-text)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Résultat
              </button>
            </div>

            {/* Single Display */}
            <div className="relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden flex items-center justify-center max-h-[380px] aspect-video">
              {activeTab === 'original' && originalUrl ? (
                renderMedia(originalUrl, 'Média original')
              ) : (
                renderMedia(resultUrl, 'Résultat face-swappé')
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 items-center justify-end pt-3 border-t border-[var(--border-color)]">
        <button
          onClick={onReset}
          id="new-swap-btn"
          className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-all flex items-center gap-2 cursor-pointer active:scale-[0.97]"
        >
          <ArrowCounterClockwise size={14} />
          Nouveau swap
        </button>

        <button
          onClick={handleDownload}
          id="download-result-btn"
          className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--emerald-main)] hover:bg-emerald-600 text-white transition-all shadow-lg shadow-[var(--emerald-bg)] flex items-center gap-2 cursor-pointer active:scale-[0.97]"
        >
          <DownloadSimple size={14} weight="bold" />
          Télécharger
        </button>
      </div>
    </div>
  );
}
