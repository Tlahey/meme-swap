'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SlidersIcon as Sliders,
  CaretDownIcon as CaretDown,
  CpuIcon as Cpu,
  UserIcon as User,
  UsersIcon as Users,
  TerminalIcon as Terminal,
  InfoIcon as Info,
  SparkleIcon as Sparkle,
  DropIcon as Drop,
  WaveformIcon as Waveform,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

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
  preset: 'low' | 'medium' | 'high' | 'custom';
  setPreset: (preset: 'low' | 'medium' | 'high' | 'custom') => void;
  faceEnhancerBlend: number;
  setFaceEnhancerBlend: (val: number) => void;
  frameEnhancerModel: string | undefined;
  setFrameEnhancerModel: (val: string | undefined) => void;
  expressionRestorerModel: string | undefined;
  setExpressionRestorerModel: (val: string | undefined) => void;
  flatMode?: boolean;
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
  preset,
  setPreset,
  faceEnhancerBlend,
  setFaceEnhancerBlend,
  frameEnhancerModel,
  setFrameEnhancerModel,
  expressionRestorerModel,
  setExpressionRestorerModel,
  flatMode = false,
}: ModelSettingsProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { t, locale } = useTranslation();

  const applyPreset = (p: 'low' | 'medium' | 'high' | 'custom') => {
    setPreset(p);
    if (p === 'low') {
      setFaceSwapperModel('inswapper_128_fp16');
      setFaceEnhancerModel(undefined);
      setFaceMaskBlend(80);
      setFaceEnhancerBlend(80);
      setFrameEnhancerModel(undefined);
      setExpressionRestorerModel(undefined);
    } else if (p === 'medium') {
      setFaceSwapperModel('inswapper_128_fp16');
      setFaceEnhancerModel('codeformer');
      setFaceMaskBlend(80);
      setFaceEnhancerBlend(80);
      setFrameEnhancerModel(undefined);
      setExpressionRestorerModel(undefined);
    } else if (p === 'high') {
      setFaceSwapperModel('inswapper_128');
      setFaceEnhancerModel('codeformer');
      setFaceMaskBlend(70);
      setFaceEnhancerBlend(90);
      setFrameEnhancerModel('real_esrgan_x2');
      setExpressionRestorerModel(undefined);
    }
  };
  
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
        return t('model.providers.coreml');
      case 'cpu':
        return t('model.providers.cpu');
      case 'cuda':
        return t('model.providers.cuda');
      default:
        return provider;
    }
  };

  const getProviderBadge = (provider: ExecutionProvider) => {
    switch (provider) {
      case 'coreml':
        return t('common.recommended');
      case 'cpu':
        return t('common.slow');
      default:
        return '';
    }
  };

  // Summary badges shown in the collapsed panel header
  const activeProviders = executionProviders.map(p => {
    if (p === 'coreml') return 'CoreML';
    if (p === 'cpu') return 'CPU';
    return 'CUDA';
  }).join(', ');
  
  const activeModulesCount = [faceSwapperModel, faceEnhancerModel, frameEnhancerModel].filter(Boolean).length;

  const settingsContent = (
    <div className="space-y-3">
      {/* ── Section 1: Modules ── */}
      <SettingsSection
        id="modules"
        title={t('model.engines')}
        subtitle={
          locale === 'en'
            ? `${activeModulesCount} active module${activeModulesCount !== 1 ? 's' : ''}`
            : `${activeModulesCount} module${activeModulesCount !== 1 ? 's' : ''} actif${activeModulesCount !== 1 ? 's' : ''}`
        }
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
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t('model.faceSwapper')}</h4>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('model.faceSwapperDesc')}</p>
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
                onChange={(e) => {
                  setPreset('custom');
                  setFaceSwapperModel(e.target.checked ? 'inswapper_128_fp16' : undefined);
                }}
              />
              <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
            </label>
          </div>

          {/* Face Enhancer */}
          <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <div className="flex gap-3">
              <Sparkle size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t('model.faceEnhancer')}</h4>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('model.faceEnhancerDesc')}</p>
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
                onChange={(e) => {
                  setPreset('custom');
                  setFaceEnhancerModel(e.target.checked ? 'codeformer' : undefined);
                }}
              />
              <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
            </label>
          </div>

          {/* Face Enhancer Blend (dosage) */}
          {faceEnhancerModel && (
            <div className="pt-2 space-y-3 border-t border-[var(--border-subtle)] mt-2">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <Drop size={12} className="text-[var(--emerald-main)]" />
                  {t('model.faceEnhancerBlend')}
                </span>
                <span className="text-[var(--emerald-main)] font-mono text-xs">{faceEnhancerBlend}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={faceEnhancerBlend}
                onChange={(e) => {
                  setPreset('custom');
                  setFaceEnhancerBlend(parseInt(e.target.value, 10));
                }}
                className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--emerald-main)]"
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                {t('model.faceEnhancerBlendDesc')}
              </p>
            </div>
          )}

          {/* Frame Enhancer (Amélioration globale) */}
          <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <div className="flex gap-3">
              <Sparkle size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t('model.frameEnhancer')}</h4>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('model.frameEnhancerDesc')}</p>
                <div className="mt-1.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] inline-block px-1.5 py-0.5 rounded">
                  real_esrgan_x2
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={frameEnhancerModel !== undefined}
                onChange={(e) => {
                  setPreset('custom');
                  setFrameEnhancerModel(e.target.checked ? 'real_esrgan_x2' : undefined);
                }}
              />
              <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
            </label>
          </div>

          {/* Expression Restorer (Restauration des expressions) */}
          <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <div className="flex gap-3">
              <Waveform size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">Expression Restorer</h4>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Restores facial expressions and details.</p>
                <div className="mt-1.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] inline-block px-1.5 py-0.5 rounded">
                  expression_restorer
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={expressionRestorerModel !== undefined}
                onChange={(e) => {
                  setPreset('custom');
                  setExpressionRestorerModel(e.target.checked ? 'expression_restorer' : undefined);
                }}
              />
              <div className="w-9 h-5 bg-[var(--border-color)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--emerald-main)]"></div>
            </label>
          </div>

          {/* Mask Blend slider */}
          <div className="pt-2 space-y-3 border-t border-[var(--border-subtle)] mt-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Drop size={12} className="text-[var(--emerald-main)]" />
                {t('model.faceMaskBlend')}
              </span>
              <span className="text-[var(--emerald-main)] font-mono text-xs">{faceMaskBlend}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={faceMaskBlend}
              onChange={(e) => {
                setPreset('custom');
                setFaceMaskBlend(parseInt(e.target.value, 10));
              }}
              className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--emerald-main)]"
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              {t('model.faceMaskBlendDesc')}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ── Section 2: Hardware ── */}
      <SettingsSection
        id="hardware"
        title={t('model.acceleration')}
        subtitle={`${executionProviders.map(p => p.toUpperCase()).join(' + ')}`}
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
        title={t('model.selectorMode')}
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
              {faceSelectorMode === 'reference' && t('model.selectorModes.reference')}
              {faceSelectorMode === 'many' && t('model.selectorModes.many')}
              {faceSelectorMode === 'one' && t('model.selectorModes.one')}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ── Section 4: Performance ── */}
      <SettingsSection
        id="perf"
        title={t('model.performance')}
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
                {t('model.threadsCpu')}
              </span>
              <span className="text-[var(--emerald-main)] font-mono text-xs">
                {threadCount} {locale === 'en' ? 'cores' : 'cœurs'}
              </span>
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
              <span>4 ({t('model.rec')})</span>
              <span>8</span>
            </div>
          </div>

          {/* Log Level */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('model.logLevel')}
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
  );

  if (flatMode) {
    return settingsContent;
  }

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
              {t('model.title')}
            </h3>
            {!isPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                <span>
                  {locale === 'en'
                    ? `${activeModulesCount} active module${activeModulesCount !== 1 ? 's' : ''}`
                    : `${activeModulesCount} module${activeModulesCount !== 1 ? 's' : ''} actif${activeModulesCount !== 1 ? 's' : ''}`}
                </span>
                <span className="w-1 h-1 rounded-full bg-[var(--border-color)] inline-block" />
                <span>{activeProviders}</span>
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t('model.subtitle')}
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

              {/* Preset Selector */}
              <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                      {t('model.presets.title')}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {t('model.presets.subtitle')}
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald-text)] shadow-sm">
                    {preset}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg">
                  {(['low', 'medium', 'high', 'custom'] as const).map((p) => {
                    const isActive = preset === p;
                    return (
                      <button
                        key={p}
                        onClick={() => applyPreset(p)}
                        type="button"
                        className={`py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer capitalize text-center ${
                          isActive
                            ? 'bg-[var(--bg-primary)] text-[var(--emerald-text)] border border-[var(--border-color)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/40'
                        }`}
                      >
                        {p === 'low' && t('model.presets.low').split(' ')[0]}
                        {p === 'medium' && t('model.presets.medium').split(' ')[0]}
                        {p === 'high' && t('model.presets.high').split(' ')[0]}
                        {p === 'custom' && t('model.presets.custom').split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {settingsContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
