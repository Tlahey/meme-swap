'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  CaretDown,
  Cpu,
  User,
  Users,
  Terminal,
  Info,
  Sparkle,
  Drop,
  Waveform,
} from '@phosphor-icons/react';

export type ExecutionProvider = 'coreml' | 'cpu' | 'cuda';
export type FaceSelectorMode = 'reference' | 'many' | 'one';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

interface ModelSettingsProps {
  executionProviders: ExecutionProvider[];
  setExecutionProviders: (providers: ExecutionProvider[]) => void;
  faceSelectorMode: FaceSelectorMode;
  setFaceSelectorMode: (mode: FaceSelectorMode) => void;
  threadCount: number;
  setThreadCount: (count: number) => void;
  logLevel: LogLevel;
  setLogLevel: (level: LogLevel) => void;
  faceMaskBlend: number;
  setFaceMaskBlend: (val: number) => void;
  faceSwapperModel: string | undefined;
  setFaceSwapperModel: (val: string | undefined) => void;
  faceEnhancerModel: string | undefined;
  setFaceEnhancerModel: (val: string | undefined) => void;
  lipSyncerModel: string | undefined;
  setLipSyncerModel: (val: string | undefined) => void;
}

interface SectionProps {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Reusable collapsible sub-section within the settings panel.
 */
function SettingsSection({ title, subtitle, icon, badge, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)]">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--bg-secondary)]/40 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="text-[var(--text-secondary)] group-hover:text-[var(--emerald-main)] transition-colors">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
              {badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald-text)] font-bold uppercase tracking-wide">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--text-muted)] shrink-0 ml-2"
        >
          <CaretDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-[var(--border-subtle)]"
          >
            <div className="p-4 bg-[var(--bg-secondary)]/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModelSettings({
  executionProviders,
  setExecutionProviders,
  faceSelectorMode,
  setFaceSelectorMode,
  threadCount,
  setThreadCount,
  logLevel,
  setLogLevel,
  faceMaskBlend,
  setFaceMaskBlend,
  faceSwapperModel,
  setFaceSwapperModel,
  faceEnhancerModel,
  setFaceEnhancerModel,
  lipSyncerModel,
  setLipSyncerModel,
}: ModelSettingsProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Track which sub-sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    modules: true,
    hardware: false,
    face: false,
    perf: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleProvider = (provider: ExecutionProvider) => {
    if (executionProviders.includes(provider)) {
      if (executionProviders.length > 1) {
        setExecutionProviders(executionProviders.filter((p) => p !== provider));
      }
    } else {
      setExecutionProviders([...executionProviders, provider]);
    }
  };

  const getProviderLabel = (provider: ExecutionProvider) => {
    switch (provider) {
      case 'coreml':
        return 'Apple Neural Engine (CoreML)';
      case 'cpu':
        return 'Processeur (CPU)';
      case 'cuda':
        return 'NVIDIA GPU (CUDA)';
      default:
        return provider;
    }
  };

  const getProviderBadge = (provider: ExecutionProvider) => {
    switch (provider) {
      case 'coreml':
        return 'Recommandé';
      case 'cpu':
        return 'Lent';
      default:
        return '';
    }
  };

  // Summary badges shown in the collapsed panel header
  const activeProviders = executionProviders.join(', ');
  const activeModulesCount = [faceSwapperModel, faceEnhancerModel, lipSyncerModel].filter(Boolean).length;

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden transition-all shadow-sm">
      {/* Main panel header */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-secondary)]/50 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald-text)] rounded-lg group-hover:scale-105 transition-transform duration-300">
            <Sliders size={18} weight="bold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Paramètres du modèle
            </h3>
            {!isPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                <span>{activeModulesCount} module{activeModulesCount !== 1 ? 's' : ''} actif{activeModulesCount !== 1 ? 's' : ''}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--border-color)] inline-block" />
                <span>{activeProviders}</span>
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Configuration FaceFusion, accélération et options
              </p>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isPanelOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
        >
          <CaretDown size={16} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/20"
          >
            <div className="p-4 space-y-3">

              {/* ── Section 1: Modules ── */}
              <SettingsSection
                id="modules"
                title="Moteurs FaceFusion"
                subtitle={`${activeModulesCount} module${activeModulesCount !== 1 ? 's' : ''} actif${activeModulesCount !== 1 ? 's' : ''}`}
                icon={<Sparkle size={16} />}
                isOpen={openSections['modules'] ?? false}
                onToggle={() => toggleSection('modules')}
              >
                <div className="space-y-3">
                  {/* Face Swapper */}
                  <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex gap-3">
                      <User size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Face Swapper</h4>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Moteur principal d'échange de visage.</p>
                        <div className="mt-1.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] inline-block px-1.5 py-0.5 rounded">
                          inswapper_128_fp16
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={faceSwapperModel !== undefined}
                        onChange={(e) => setFaceSwapperModel(e.target.checked ? 'inswapper_128_fp16' : undefined)}
                      />
                      <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
                    </label>
                  </div>

                  {/* Face Enhancer */}
                  <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex gap-3">
                      <Sparkle size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Amélioration du Visage</h4>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Restaure les détails et affine la netteté.</p>
                        <div className="mt-1.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] inline-block px-1.5 py-0.5 rounded">
                          codeformer
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={faceEnhancerModel !== undefined}
                        onChange={(e) => setFaceEnhancerModel(e.target.checked ? 'codeformer' : undefined)}
                      />
                      <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
                    </label>
                  </div>

                  {/* Lip Syncer */}
                  <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex gap-3">
                      <Waveform size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Synchronisation Labiale</h4>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Synchronise le mouvement des lèvres.</p>
                        <div className="mt-1.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] inline-block px-1.5 py-0.5 rounded">
                          wav2lip_gan_96
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={lipSyncerModel !== undefined}
                        onChange={(e) => setLipSyncerModel(e.target.checked ? 'wav2lip_gan_96' : undefined)}
                      />
                      <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
                    </label>
                  </div>

                  {/* Mask Blend slider — kept inside modules as it's a module-level setting */}
                  <div className="pt-2 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <Drop size={12} className="text-[var(--emerald-main)]" />
                        Face Mask Blend
                      </span>
                      <span className="text-[var(--emerald-main)] font-mono text-xs">{faceMaskBlend}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={faceMaskBlend}
                      onChange={(e) => setFaceMaskBlend(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--emerald-main)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Lissage des bords du masque sur le visage cible. (Défaut: 80)
                    </p>
                  </div>
                </div>
              </SettingsSection>

              {/* ── Section 2: Hardware ── */}
              <SettingsSection
                id="hardware"
                title="Accélération Matérielle"
                subtitle={`${executionProviders.join(' + ')}`}
                icon={<Cpu size={16} />}
                isOpen={openSections['hardware'] ?? false}
                onToggle={() => toggleSection('hardware')}
              >
                <div className="space-y-2">
                  {(['coreml', 'cpu'] as ExecutionProvider[]).map((prov) => {
                    const isActive = executionProviders.includes(prov);
                    const badge = getProviderBadge(prov);
                    return (
                      <button
                        key={prov}
                        onClick={() => toggleProvider(prov)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                          isActive
                            ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald-text)] shadow-sm'
                            : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/50 hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive
                                ? 'bg-[var(--emerald-main)] shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : 'bg-[var(--border-color)]'
                            }`}
                          />
                          <span className="font-medium text-xs">{getProviderLabel(prov)}</span>
                        </div>
                        {badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold border ${
                              isActive
                                ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald-text)]'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)]'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </SettingsSection>

              {/* ── Section 3: Face Selector ── */}
              <SettingsSection
                id="face"
                title="Mode du Sélecteur de Visage"
                subtitle={faceSelectorMode}
                icon={<User size={16} />}
                isOpen={openSections['face'] ?? false}
                onToggle={() => toggleSection('face')}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(['reference', 'many', 'one'] as FaceSelectorMode[]).map((mode) => {
                      const isActive = faceSelectorMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setFaceSelectorMode(mode)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl border text-center gap-1.5 transition-all ${
                            isActive
                              ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald-text)]'
                              : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/50 hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {mode === 'reference' && <User size={16} />}
                          {mode === 'many' && <Users size={16} />}
                          {mode === 'one' && <User size={16} weight="light" />}
                          <span className="text-[10px] font-bold capitalize">{mode}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-[var(--bg-primary)] rounded-xl p-3 border border-[var(--border-color)] flex items-start gap-2">
                    <Info size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {faceSelectorMode === 'reference' && 'Remplace le visage le plus similaire au visage source.'}
                      {faceSelectorMode === 'many' && 'Remplace tous les visages détectés dans le média cible.'}
                      {faceSelectorMode === 'one' && 'Remplace uniquement le premier visage détecté.'}
                    </p>
                  </div>
                </div>
              </SettingsSection>

              {/* ── Section 4: Performance ── */}
              <SettingsSection
                id="perf"
                title="Performances"
                subtitle={`${threadCount} thread${threadCount > 1 ? 's' : ''} · log ${logLevel}`}
                icon={<Terminal size={16} />}
                isOpen={openSections['perf'] ?? false}
                onToggle={() => toggleSection('perf')}
              >
                <div className="space-y-5">
                  {/* Thread Count */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Threads CPU
                      </span>
                      <span className="text-[var(--emerald-main)] font-mono text-xs">{threadCount} cœurs</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={threadCount}
                      onChange={(e) => setThreadCount(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--emerald-main)]"
                    />
                    <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
                      <span>1</span>
                      <span>4 (Rec.)</span>
                      <span>8</span>
                    </div>
                  </div>

                  {/* Log Level */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Niveau de log
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['debug', 'info', 'warning', 'error'] as LogLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setLogLevel(level)}
                          className={`py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wide transition-all ${
                            logLevel === level
                              ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[var(--emerald-text)]'
                              : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SettingsSection>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
