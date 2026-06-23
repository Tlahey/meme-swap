'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MagnifyingGlassIcon as SearchIcon, SparkleIcon as Sparkle, InfoIcon as Info, GearIcon as Settings } from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';
import { giphy, GiphyGif } from '@meme-swap/api-client';

interface GiphySearchProps {
  onSelect: (gif: GiphyGif) => void;
  onOpenSettings?: () => void;
  selectedGifId?: string | null;
}

const SEARCH_PILLS = [
  { label: '#barbie', query: 'barbie' },
  { label: '#homer', query: 'homer simpson' },
  { label: '#drake', query: 'drake' },
  { label: '#office', query: 'the office' },
  { label: '#spiderman', query: 'spiderman' },
  { label: '#gatsby', query: 'gatsby' },
  { label: '#celebrate', query: 'celebrate' },
];

export function GiphySearch({ onSelect, onOpenSettings, selectedGifId }: GiphySearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // Check Giphy key configuration status on mount/update
  const checkConfig = async () => {
    if (typeof window === 'undefined') return;
    
    // Check localStorage
    const localKey = window.localStorage.getItem('giphy_api_key');
    if (localKey && localKey.trim().length > 0) {
      setIsFallbackMode(false);
      return;
    }

    // Check Electron IPC
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.isGiphyConfigured === 'function') {
      try {
        const configured = await electronAPI.isGiphyConfigured();
        setIsFallbackMode(!configured);
        return;
      } catch (e) {
        setIsFallbackMode(true);
      }
    }

    // Check Next.js server API
    try {
      const res = await fetch('/api/giphy/config');
      if (res.ok) {
        const data = await res.json();
        setIsFallbackMode(!data.configured);
      } else {
        setIsFallbackMode(true);
      }
    } catch (e) {
      setIsFallbackMode(true);
    }
  };

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await giphy.trending({ limit: 12 });
      setGifs(res.data || []);
    } catch (e) {
      console.error('Error fetching trending GIFs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConfig();
    fetchTrending();
  }, []);

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) {
      fetchTrending();
      return;
    }
    setLoading(true);
    try {
      const res = await giphy.search({ query: q, limit: 12 });
      setGifs(res.data || []);
    } catch (e) {
      console.error('Error searching GIFs:', e);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handlePillClick = (pillQuery: string) => {
    setQuery(pillQuery);
    handleSearch(pillQuery);
  };

  const handleDragStart = (e: React.DragEvent, gif: GiphyGif) => {
    const dataToSend = {
      gifUrl: gif.images.original.url,
      title: gif.title,
      id: gif.id
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dataToSend));
    // Standard text/plain fallback for basic drop zones
    e.dataTransfer.setData('text/plain', gif.images.original.url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Search Input Bar */}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('giphySearch.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--emerald-main)] text-sm text-[var(--text-primary)] transition-all"
          />
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--emerald-main)] text-[var(--text-primary)] hover:text-white rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-95"
        >
          {t('giphySearch.searchButton')}
        </button>
      </form>

      {/* Pills Container */}
      <div className="flex flex-wrap gap-1.5 items-center max-h-20 overflow-y-auto pr-1">
        {SEARCH_PILLS.map((pill) => (
          <button
            key={pill.label}
            type="button"
            onClick={() => handlePillClick(pill.query)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
              query.toLowerCase() === pill.query.toLowerCase()
                ? 'bg-[var(--emerald-bg)] border-[var(--emerald-main)] text-[var(--emerald-text)] shadow-sm'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Mode Badge & Alert */}
      {isFallbackMode && (
        <div className="flex items-center justify-between p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[10px] text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {t('giphySearch.offlineBadge')}
          </span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              type="button"
              className="text-[var(--emerald-text)] font-bold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Settings size={12} />
              Activer la recherche
            </button>
          )}
        </div>
      )}

      {/* GIF Grid Area */}
      <div className="relative min-h-[220px] flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/50 backdrop-blur-xs rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <Sparkle size={24} className="animate-spin text-[var(--emerald-main)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {t('common.loading')}
              </span>
            </div>
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-muted)] text-xs font-medium space-y-1">
            <p>{t('giphySearch.noResults')}</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4">
            {gifs.map((gif) => {
              const isSelected = selectedGifId === gif.id;
              return (
                <div
                  key={gif.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, gif)}
                  onClick={() => onSelect(gif)}
                  className={`break-inside-avoid mb-3 group relative rounded-xl overflow-hidden cursor-pointer border transition-all duration-300 ${
                    isSelected
                      ? 'border-[var(--emerald-main)] shadow-[0_0_12px_var(--emerald-bg)] scale-[0.98]'
                      : 'border-[var(--border-color)] hover:border-[var(--emerald-main)]/50 bg-[var(--bg-secondary)] hover:shadow-md hover:scale-[1.01]'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="w-full h-auto select-none pointer-events-none group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                    <span className="text-[9px] text-white font-medium truncate w-full">
                      {gif.title.length > 20 ? `${gif.title.substring(0, 18)}...` : gif.title}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute inset-0 bg-[var(--emerald-bg)]/20 flex items-center justify-center pointer-events-none">
                      <div className="px-2 py-0.5 bg-[var(--emerald-main)] text-white text-[9px] font-bold rounded-md shadow-sm">
                        Sélectionné
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
