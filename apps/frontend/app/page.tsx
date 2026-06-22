'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

import {
  UploadSimpleIcon as UploadSimple,
  FileVideoIcon as FileVideo,
  CpuIcon as Cpu,
  SparkleIcon as Sparkle,
  WarningIcon as Warning,
  LightningIcon as Lightning,
  ArrowsLeftRightIcon as ArrowsLeftRight,
  MoonIcon as Moon,
  SunIcon as Sun,
} from '@phosphor-icons/react';
import { UploadZone } from './components/UploadZone';
import { ProcessSteps, Step } from './components/ProcessSteps';
import { ResultDisplay } from './components/ResultDisplay';
import { ModelSettings, ExecutionProvider, FaceSelectorMode, LogLevel } from './components/ModelSettings';
import { McpSettings } from './components/McpSettings';
import { I18nProvider, useTranslation } from '@meme-swap/i18n';

interface FaceswapResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export default function Home() {
  return (
    <I18nProvider>
      <HomeContent />
    </I18nProvider>
  );
}

function HomeContent() {
  const { t, locale, setLocale } = useTranslation();
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [targetGif, setTargetGif] = useState<File | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<FaceswapResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Model parameters state
  const [executionProviders, setExecutionProviders] = useState<ExecutionProvider[]>(['coreml', 'cpu']);
  const [faceSelectorMode, setFaceSelectorMode] = useState<FaceSelectorMode>('reference');
  const [threadCount, setThreadCount] = useState<number>(4);
  const [logLevel, setLogLevel] = useState<LogLevel>('info');

  // Strict FaceFusion options
  const [faceMaskBlend, setFaceMaskBlend] = useState<number>(80);
  const [faceSwapperModel, setFaceSwapperModel] = useState<string | undefined>('inswapper_128_fp16');
  const [faceEnhancerModel, setFaceEnhancerModel] = useState<string | undefined>('codeformer');

  // Stepper state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepStatuses, setStepStatuses] = useState<
    ('idle' | 'running' | 'completed' | 'failed')[]
  >(['idle', 'idle', 'idle', 'idle']);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Tabs and MCP state
  const [activeTab, setActiveTab] = useState<'generation' | 'mcp'>('generation');
  const [isMcpActive, setIsMcpActive] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMcpStatus = async () => {
      try {
        const res = await fetch('/api/mcp-status');
        if (res.ok) {
          const data = await res.json();
          setIsMcpActive(data.active);
        } else {
          setIsMcpActive(false);
        }
      } catch (e) {
        setIsMcpActive(false);
      }
    };

    checkMcpStatus();
    const interval = setInterval(checkMcpStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refs for scrolling
  const processStepsRef = useRef<HTMLDivElement>(null);
  const resultDisplayRef = useRef<HTMLDivElement>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleSourceChange = (file: File) => {
    setSourceImage(file);
    setResult(null);
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    setSourcePreviewUrl(URL.createObjectURL(file));
  };

  const handleTargetChange = (file: File) => {
    setTargetGif(file);
    setResult(null);
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl);
    setTargetPreviewUrl(URL.createObjectURL(file));
  };

  const [isTestLoading, setIsTestLoading] = useState(false);

  const handleLoadTestData = async () => {
    setIsTestLoading(true);
    try {
      const sourceResponse = await fetch('/test-images/source.jpg');
      if (sourceResponse.ok) {
        const sourceBlob = await sourceResponse.blob();
        const sourceFile = new File([sourceBlob], 'source.jpg', { type: 'image/jpeg' });
        handleSourceChange(sourceFile);
      }

      const targetResponse = await fetch('/test-images/target.gif');
      if (targetResponse.ok) {
        const targetBlob = await targetResponse.blob();
        const targetFile = new File([targetBlob], 'target.gif', { type: 'image/gif' });
        handleTargetChange(targetFile);
      }
    } catch (e) {
      console.error('Failed to load test data', e);
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSourceRemove = () => {
    setSourceImage(null);
    setResult(null);
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    setSourcePreviewUrl(null);
  };

  const handleTargetRemove = () => {
    setTargetGif(null);
    setResult(null);
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl);
    setTargetPreviewUrl(null);
  };

  // Define steps
  const steps: Step[] = [
    {
      id: 1,
      label: t('process.steps.upload.label'),
      description: t('process.steps.upload.desc'),
      status: stepStatuses[0] ?? 'idle',
      icon: UploadSimple,
    },
    {
      id: 2,
      label: t('process.steps.pre.label'),
      description: t('process.steps.pre.desc'),
      status: stepStatuses[1] ?? 'idle',
      icon: FileVideo,
    },
    {
      id: 3,
      label: t('process.steps.inference.label'),
      description: t('process.steps.inference.desc'),
      status: stepStatuses[2] ?? 'idle',
      icon: Cpu,
    },
    {
      id: 4,
      label: t('process.steps.final.label'),
      description: t('process.steps.final.desc'),
      status: stepStatuses[3] ?? 'idle',
      icon: Sparkle,
    },
  ];

  const startSimulation = () => {
    // Reset steps
    setCurrentStepIndex(0);
    setStepStatuses(['running', 'idle', 'idle', 'idle']);

    let currentIdx = 0;
    const timeline = [
      { step: 0, nextAt: 1500 }, // Upload takes 1.5s
      { step: 1, nextAt: 4000 }, // Preprocessing takes 2.5s more
      { step: 2, nextAt: 99999 }, // Inference takes dynamic time until resolve
    ];

    const runNext = () => {
      const currentConfig = timeline[currentIdx];
      if (!currentConfig) return;

      simulationIntervalRef.current = setTimeout(() => {
        setStepStatuses((prev) => {
          const next = [...prev];
          next[currentIdx] = 'completed';
          if (currentIdx + 1 < next.length) {
            next[currentIdx + 1] = 'running';
          }
          return next;
        });
        currentIdx += 1;
        setCurrentStepIndex(currentIdx);

        if (currentIdx < timeline.length - 1) {
          runNext();
        }
      }, currentConfig.nextAt - (timeline[currentIdx - 1]?.nextAt || 0));
    };

    runNext();
  };

  const stopSimulation = (success: boolean) => {
    if (simulationIntervalRef.current) {
      clearTimeout(simulationIntervalRef.current);
    }

    if (success) {
      // Transition step 2 to complete, then step 3 to running, then complete step 3
      setStepStatuses((prev) => {
        const next = [...prev];
        // Mark all preceding steps as completed
        for (let i = 0; i < 3; i++) {
          next[i] = 'completed';
        }
        next[3] = 'running';
        return next;
      });
      setCurrentStepIndex(3);

      setTimeout(() => {
        setStepStatuses(['completed', 'completed', 'completed', 'completed']);
        setCurrentStepIndex(4);
      }, 1000);
    } else {
      // Mark current index as failed
      setStepStatuses((prev) => {
        const next = [...prev];
        const activeIdx = Math.min(currentStepIndex, 3);
        next[activeIdx] = 'failed';
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (!sourceImage || !targetGif) return;

    setIsProcessing(true);
    setResult(null);
    startSimulation();

    // Scroll to progress
    setTimeout(() => {
      processStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    try {
      const formData = new FormData();
      formData.append('source', sourceImage);
      formData.append('target', targetGif);
      formData.append('executionProviders', executionProviders.join(','));
      formData.append('faceSelectorMode', faceSelectorMode);
      formData.append('threadCount', threadCount.toString());
      formData.append('logLevel', logLevel);
      formData.append('faceMaskBlend', faceMaskBlend.toString());
      if (faceSwapperModel) formData.append('faceSwapperModel', faceSwapperModel);
      if (faceEnhancerModel) formData.append('faceEnhancerModel', faceEnhancerModel);

      const response = await fetch('/api/faceswap', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        stopSimulation(true);
        // Wait for final step completion animation
        setTimeout(() => {
          setResult({ success: true, outputPath: data.outputPath });
          setPreviewUrl(data.outputPath);
          setIsProcessing(false);
          // Scroll to result
          setTimeout(() => {
            resultDisplayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }, 1200);
      } else {
        stopSimulation(false);
        setTimeout(() => {
          setResult({ success: false, error: data.error });
          setIsProcessing(false);
        }, 800);
      }
    } catch (error) {
      stopSimulation(false);
      setTimeout(() => {
        setResult({
          success: false,
          error:
            error instanceof Error ? error.message : 'Une erreur est survenue',
        });
        setIsProcessing(false);
      }, 800);
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setTargetGif(null);
    setResult(null);
    setPreviewUrl(null);
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl);
    setSourcePreviewUrl(null);
    setTargetPreviewUrl(null);
    setCurrentStepIndex(0);
    setStepStatuses(['idle', 'idle', 'idle', 'idle']);
    // Scroll back top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shouldReduceMotion = useReducedMotion();

  const sourceUrlRef = useRef<string | null>(null);
  const targetUrlRef = useRef<string | null>(null);

  useEffect(() => {
    sourceUrlRef.current = sourcePreviewUrl;
  }, [sourcePreviewUrl]);

  useEffect(() => {
    targetUrlRef.current = targetPreviewUrl;
  }, [targetPreviewUrl]);

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (targetUrlRef.current) URL.revokeObjectURL(targetUrlRef.current);
      if (simulationIntervalRef.current) {
        clearTimeout(simulationIntervalRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden flex flex-col selection:bg-[var(--emerald-bg)] selection:text-[var(--emerald-text)]">
      
      {/* Header Bar */}
      <div className="w-full h-16 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl w-full h-full mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[var(--emerald-main)] rounded-md text-white shadow-sm">
              <Lightning size={16} weight="fill" />
            </div>
            <span className="font-bold tracking-tight text-lg">{t('common.memeSwap')}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)] text-[10px] font-mono select-none">
              <button
                onClick={() => setLocale('en')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer font-bold ${
                  locale === 'en'
                    ? 'bg-[var(--bg-primary)] text-[var(--emerald-text)] border border-[var(--border-color)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLocale('fr')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer font-bold ${
                  locale === 'fr'
                    ? 'bg-[var(--bg-primary)] text-[var(--emerald-text)] border border-[var(--border-color)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                FR
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col gap-10 px-4 md:px-8 py-10">
        
        {/* Title Area */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <motion.h1
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text-primary)]"
          >
            {t('page.titlePrefix')} {' '}
            <span className="text-[var(--emerald-main)]">
              {t('page.titleSuffix')}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.1 }}
            className="text-base text-[var(--text-secondary)]"
          >
            {t('page.subtitle')}
          </motion.p>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Uploaders */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 shadow-sm">
              <UploadZone
                id="source-upload"
                label="Visage source"
                accept="image/*"
                file={sourceImage}
                previewUrl={sourcePreviewUrl}
                onChange={handleSourceChange}
                onRemove={handleSourceRemove}
                description="Image claire, de face (JPG, PNG)"
                type="image"
                isProcessing={isProcessing}
              />

              <div className="border-t border-[var(--border-subtle)]" />

              <UploadZone
                id="target-upload"
                label="Média cible"
                accept=".gif,.mp4"
                file={targetGif}
                previewUrl={targetPreviewUrl}
                onChange={handleTargetChange}
                onRemove={handleTargetRemove}
                description="GIF ou vidéo MP4 à modifier"
                type="video"
                isProcessing={isProcessing}
              />
            </div>

            {/* Welcome Placeholder / Tips */}
            {!isProcessing && !result && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] mt-0.5">
                    <Sparkle size={18} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {t('page.tipsTitle')}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {t('page.tipsDesc')}
                    </p>
                    <button
                      onClick={handleLoadTestData}
                      disabled={isTestLoading}
                      className="mt-2 px-3 py-1.5 bg-[var(--emerald-bg)] hover:bg-[var(--emerald-border)] text-[var(--emerald-text)] rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                    >
                      {isTestLoading ? <Sparkle size={14} className="animate-spin" /> : <Sparkle size={14} />}
                      {isTestLoading ? `${t('common.loading')}` : t('page.tryTestData')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Model Settings & Actions */}
          <div className="space-y-6">
            {/* Tabs Header */}
            <div className="flex p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl">
              <button
                onClick={() => setActiveTab('generation')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'generation'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {t('page.genSettings')}
              </button>
              <button
                onClick={() => setActiveTab('mcp')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'mcp'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isMcpActive ? 'bg-[var(--emerald-main)] animate-pulse' : 'bg-rose-500'}`} />
                {t('page.mcpServer')}
              </button>
            </div>

            {activeTab === 'generation' ? (
              <ModelSettings
                executionProviders={executionProviders}
                setExecutionProviders={setExecutionProviders}
                faceSelectorMode={faceSelectorMode}
                setFaceSelectorMode={setFaceSelectorMode}
                threadCount={threadCount}
                setThreadCount={setThreadCount}
                logLevel={logLevel}
                setLogLevel={setLogLevel}
                faceMaskBlend={faceMaskBlend}
                setFaceMaskBlend={setFaceMaskBlend}
                faceSwapperModel={faceSwapperModel}
                setFaceSwapperModel={setFaceSwapperModel}
                faceEnhancerModel={faceEnhancerModel}
                setFaceEnhancerModel={setFaceEnhancerModel}
              />
            ) : (
              <McpSettings isMcpActive={isMcpActive} />
            )}

            {/* Action Trigger Button */}
            {activeTab === 'generation' && (
              <button
                onClick={handleSubmit}
                disabled={!sourceImage || !targetGif || isProcessing || !!result}
                className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  !sourceImage || !targetGif || isProcessing || !!result
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                    : 'bg-[var(--emerald-main)] hover:bg-emerald-600 text-white shadow-md active:scale-[0.98]'
                }`}
              >
                <ArrowsLeftRight size={18} weight="bold" />
                {isProcessing ? `${t('page.processing')}` : t('page.startSwap')}
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Status / Process Section */}
        <AnimatePresence mode="wait">
          {(isProcessing || result) && (
            <motion.div
              key="status-section"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-3xl mx-auto space-y-6 pt-6 border-t border-[var(--border-subtle)]"
            >
              
              {/* Stepper Component */}
              <div ref={processStepsRef} className="scroll-mt-24">
                <ProcessSteps steps={steps} currentStepIndex={currentStepIndex} />
              </div>

              {/* Error Alert */}
              {result && !result.success && (
                <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex gap-3 items-start text-[var(--danger-text)]">
                    <Warning size={20} className="shrink-0 mt-0.5" weight="fill" />
                    <div>
                      <h3 className="text-sm font-bold">{t('page.errorOccurred')}</h3>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">
                        {t('page.checkSettings')}
                      </p>
                    </div>
                  </div>
                  {result.error && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('page.technicalDetails')}
                      </span>
                      <pre className="text-xs text-[var(--text-secondary)] mt-2 font-mono whitespace-pre-wrap overflow-x-auto">
                        {result.error}
                      </pre>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handleReset}
                      className="px-5 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
                    >
                      {t('common.reset')}
                    </button>
                  </div>
                </div>
              )}

              {/* Success Result */}
              {result && result.success && (
                <div ref={resultDisplayRef} className="scroll-mt-24">
                  <ResultDisplay
                    originalUrl={targetPreviewUrl}
                    resultUrl={previewUrl!}
                    isMp4={targetGif?.name.toLowerCase().endsWith('.mp4') || false}
                    onReset={handleReset}
                  />
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        <footer className="text-center text-[var(--text-muted)] text-[10px] font-medium tracking-widest pt-10 pb-4">
          {t('page.footerText')}
        </footer>
      </div>
    </main>
  );
}

