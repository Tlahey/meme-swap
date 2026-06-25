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
  GearIcon as Gear,
} from '@phosphor-icons/react';
import { UploadZone } from './components/UploadZone';
import { ProcessSteps, Step } from './components/ProcessSteps';
import { ResultDisplay } from './components/ResultDisplay';
import { ModelSettings, ExecutionProvider, FaceSelectorMode, LogLevel } from './components/ModelSettings';
import { McpSettings } from './components/McpSettings';
import { SettingsModal } from './components/SettingsModal';
import { GiphySearch } from './components/GiphySearch';
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
  const [faceswapProgress, setFaceswapProgress] = useState<{ step: string; percent: number } | null>(null);

  // States for source face history
  const [historyList, setHistoryList] = useState<{ filename: string; url: string; timestamp: number }[]>([]);
  const [selectedHistoryFilename, setSelectedHistoryFilename] = useState<string | null>(null);
  const [isSavingHistory, setIsSavingHistory] = useState<boolean>(false);

  const loadHistory = async () => {
    if (typeof window === 'undefined') return;

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.getSourceHistory === 'function') {
      try {
        const res = await electronAPI.getSourceHistory();
        if (res.success && res.history) {
          setHistoryList(res.history);
        }
      } catch (e) {
        console.error('Failed to load history from Electron', e);
      }
      return;
    }

    try {
      const res = await fetch('/api/source-history');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.history) {
          setHistoryList(data.history);
        }
      }
    } catch (e) {
      console.error('Failed to load history from Web API', e);
    }
  };

  // Giphy states
  const [isGiphyConfigured, setIsGiphyConfigured] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [giphySearchTab, setGiphySearchTab] = useState<'search' | 'upload'>('search');
  const [isGiphyLoading, setIsGiphyLoading] = useState<boolean>(false);

  const checkGiphyConfiguration = async () => {
    if (typeof window === 'undefined') return;

    // Check localStorage
    const localKey = window.localStorage.getItem('giphy_api_key');
    if (localKey && localKey.trim().length > 0) {
      setIsGiphyConfigured(true);
      return;
    }

    // Check Electron IPC
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.isGiphyConfigured === 'function') {
      try {
        const configured = await electronAPI.isGiphyConfigured();
        setIsGiphyConfigured(configured);
        return;
      } catch (e) {
        setIsGiphyConfigured(false);
      }
    }

    // Check Web API route
    try {
      const res = await fetch('/api/giphy/config');
      if (res.ok) {
        const data = await res.json();
        setIsGiphyConfigured(data.configured);
      } else {
        setIsGiphyConfigured(false);
      }
    } catch (e) {
      setIsGiphyConfigured(false);
    }
  };

  useEffect(() => {
    checkGiphyConfiguration();
    loadHistory();
  }, []);

  const handleSelectGiphy = async (gif: any) => {
    const gifUrl = gif.images.original.url;
    setIsGiphyLoading(true);
    try {
      const response = await fetch(gifUrl);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const cleanTitle = gif.title ? gif.title.replace(/[^a-zA-Z0-9]/g, '_') : 'giphy';
      const file = new File([blob], `${cleanTitle}.gif`, { type: 'image/gif' });
      handleTargetChange(file);
    } catch (e) {
      alert(t('giphySearch.fetchingError') || 'Failed to download selected GIF.');
    } finally {
      setIsGiphyLoading(false);
    }
  };

  // Model parameters state
  const [executionProviders, setExecutionProviders] = useState<ExecutionProvider[]>(['coreml', 'cpu']);
  const [faceSelectorMode, setFaceSelectorMode] = useState<FaceSelectorMode>('reference');
  const [threadCount, setThreadCount] = useState<number>(4);
  const [logLevel, setLogLevel] = useState<LogLevel>('info');

  // Strict FaceFusion options
  const [preset, setPreset] = useState<'low' | 'medium' | 'high' | 'custom'>('medium');
  const [faceMaskBlend, setFaceMaskBlend] = useState<number>(80);
  const [faceSwapperModel, setFaceSwapperModel] = useState<string | undefined>('inswapper_128_fp16');
  const [faceEnhancerModel, setFaceEnhancerModel] = useState<string | undefined>('codeformer');
  const [faceEnhancerBlend, setFaceEnhancerBlend] = useState<number>(80);
  const [frameEnhancerModel, setFrameEnhancerModel] = useState<string | undefined>(undefined);
  const [expressionRestorerModel, setExpressionRestorerModel] = useState<string | undefined>(undefined);

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
  const [mcpPort, setMcpPort] = useState<string>('3001');

  useEffect(() => {
    const checkMcpStatus = async () => {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        try {
          const status = await electronAPI.getMcpStatus();
          setIsMcpActive(status.active);
          if (status.port) {
            setMcpPort(status.port);
          }
        } catch (e) {
          setIsMcpActive(false);
        }
      } else {
        try {
          const res = await fetch('/api/mcp-status');
          if (res.ok) {
            const data = await res.json();
            setIsMcpActive(data.active);
            if (data.port) {
              setMcpPort(data.port);
            }
          } else {
            setIsMcpActive(false);
          }
        } catch (e) {
          setIsMcpActive(false);
        }
      }
    };

    checkMcpStatus();
    const interval = setInterval(checkMcpStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for progress from Electron IPC
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.onFaceswapProgress === 'function') {
      const unsubscribe = electronAPI.onFaceswapProgress((event: any, progress: { step: string; percent: number }) => {
        // Clear simulation interval since we are getting real progress
        if (simulationIntervalRef.current) {
          clearTimeout(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }

        // Set stepper to step 2 (inference)
        setCurrentStepIndex(2);
        setStepStatuses((prev) => {
          const next = [...prev];
          next[0] = 'completed';
          next[1] = 'completed';
          next[2] = 'running';
          next[3] = 'idle';
          return next;
        });

        setFaceswapProgress(progress);
      });
      return unsubscribe;
    }
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

  const handleSourceChange = async (file: File) => {
    setResult(null);
    setIsSavingHistory(true);
    
    // Show local preview immediately using blob URL
    const tempBlobUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(tempBlobUrl);

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && typeof electronAPI.saveSourceFace === 'function') {
        const path = (file as any).path;
        let saveResult;
        if (path) {
          saveResult = await electronAPI.saveSourceFace({ path, name: file.name });
        } else {
          const buffer = new Uint8Array(await file.arrayBuffer());
          saveResult = await electronAPI.saveSourceFace({ data: buffer, name: file.name });
        }

        if (saveResult.success) {
          setHistoryList(saveResult.history);
          setSelectedHistoryFilename(saveResult.savedFilename);
          setSourceImage(null);
          // Revoke temporary blob URL and use persistent history URL
          URL.revokeObjectURL(tempBlobUrl);
          setSourcePreviewUrl(`/api/source-history/${saveResult.savedFilename}`);
        } else {
          setSourceImage(file);
          setSelectedHistoryFilename(null);
        }
      } else {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/source-history', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setHistoryList(data.history);
            setSelectedHistoryFilename(data.savedFilename);
            setSourceImage(null);
            URL.revokeObjectURL(tempBlobUrl);
            setSourcePreviewUrl(`/api/source-history/${data.savedFilename}`);
          } else {
            setSourceImage(file);
            setSelectedHistoryFilename(null);
          }
        } else {
          setSourceImage(file);
          setSelectedHistoryFilename(null);
        }
      }
    } catch (e) {
      console.error('Failed to save source image to history:', e);
      setSourceImage(file);
      setSelectedHistoryFilename(null);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleSelectFromHistory = (filename: string) => {
    setSelectedHistoryFilename(filename);
    setSourceImage(null);
    setResult(null);
    if (sourcePreviewUrl && sourcePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(sourcePreviewUrl);
    }
    setSourcePreviewUrl(`/api/source-history/${filename}`);
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
    setSelectedHistoryFilename(null);
    setResult(null);
    if (sourcePreviewUrl) {
      if (sourcePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    }
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
    if ((!sourceImage && !selectedHistoryFilename) || !targetGif) return;

    setIsProcessing(true);
    setResult(null);
    setFaceswapProgress(null);
    startSimulation();

    // Scroll to progress
    setTimeout(() => {
      processStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    try {
      let data;
      const electronAPI = (window as any).electronAPI;

      let sourceData: any;
      let sourceName = '';
      if (selectedHistoryFilename) {
        sourceData = `history:${selectedHistoryFilename}`;
        sourceName = selectedHistoryFilename;
      } else if (sourceImage) {
        const sourcePath = (sourceImage as any).path;
        sourceData = sourcePath ? sourcePath : new Uint8Array(await sourceImage.arrayBuffer());
        sourceName = sourceImage.name;
      }

      if (electronAPI) {
        // En mode desktop Electron, on passe par l'IPC
        const targetPath = (targetGif as any).path;
        const targetData = targetPath ? targetPath : new Uint8Array(await targetGif.arrayBuffer());

        data = await electronAPI.runFaceswap({
          source: sourceData,
          sourceName,
          target: targetData,
          targetName: targetGif.name,
          executionProviders,
          faceSelectorMode,
          threadCount,
          logLevel,
          faceMaskBlend,
          faceSwapperModel,
          faceEnhancerModel,
          faceEnhancerBlend,
          frameEnhancerModel,
          expressionRestorerModel,
        });
      } else {
        // En mode web standard
        const formData = new FormData();
        if (selectedHistoryFilename) {
          formData.append('source', `history:${selectedHistoryFilename}`);
        } else if (sourceImage) {
          formData.append('source', sourceImage);
        }
        formData.append('target', targetGif);
        formData.append('executionProviders', executionProviders.join(','));
        formData.append('faceSelectorMode', faceSelectorMode);
        formData.append('threadCount', threadCount.toString());
        formData.append('logLevel', logLevel);
        formData.append('faceMaskBlend', faceMaskBlend.toString());
        if (faceSwapperModel) formData.append('faceSwapperModel', faceSwapperModel);
        if (faceEnhancerModel) formData.append('faceEnhancerModel', faceEnhancerModel);
        if (faceEnhancerBlend !== undefined) formData.append('faceEnhancerBlend', faceEnhancerBlend.toString());
        if (frameEnhancerModel) formData.append('frameEnhancerModel', frameEnhancerModel);
        if (expressionRestorerModel) formData.append('expressionRestorerModel', expressionRestorerModel);

        const response = await fetch('/api/faceswap', {
          method: 'POST',
          body: formData,
        });

        data = await response.json();
      }

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
    setSelectedHistoryFilename(null);
    setTargetGif(null);
    setResult(null);
    setPreviewUrl(null);
    setFaceswapProgress(null);
    if (sourcePreviewUrl && sourcePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(sourcePreviewUrl);
    }
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl);
    setSourcePreviewUrl(null);
    setTargetPreviewUrl(null);
    setCurrentStepIndex(0);
    setStepStatuses(['idle', 'idle', 'idle', 'idle']);
    // Reset quality parameters
    setPreset('medium');
    setFaceSwapperModel('inswapper_128_fp16');
    setFaceEnhancerModel('codeformer');
    setFaceMaskBlend(80);
    setFaceEnhancerBlend(80);
    setFrameEnhancerModel(undefined);
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
        <div className="max-w-[1150px] w-full h-full mx-auto px-4 md:px-8 flex items-center justify-between">
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
              className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] cursor-pointer"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Gear Icon Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] cursor-pointer"
              aria-label="Open Settings"
            >
              <Gear size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1150px] w-full mx-auto flex-1 flex flex-col gap-8 px-4 md:px-8 py-10">
        
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

        {/* Tab Header (Generator vs MCP) */}
        <div className="flex p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl max-w-xs mx-auto w-full shadow-sm">
          <button
            onClick={() => setActiveTab('generation')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'generation'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t('page.genSettings') || 'Générateur'}
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'mcp'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMcpActive ? 'bg-[var(--emerald-main)] animate-pulse' : 'bg-rose-500'}`} />
            {t('page.mcpServer') || 'Serveur MCP'}
          </button>
        </div>

        {activeTab === 'mcp' ? (
          <div className="w-full">
            <McpSettings isMcpActive={isMcpActive} mcpPort={mcpPort} />
          </div>
        ) : (
          <div className="flex flex-col gap-8 w-full">
            {/* 1. TOP SECTION (Full Width): Target GIF Selector or selected banner */}
            <div className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
              {targetGif ? (
                /* Compact Selected Preview Banner */
                <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <div className="relative h-[200px] w-auto rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0 shadow-inner flex items-center justify-center">
                      {targetPreviewUrl && (
                        targetGif.name.toLowerCase().endsWith('.mp4') ? (
                          <video
                            src={targetPreviewUrl}
                            className="h-full w-auto object-contain"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={targetPreviewUrl}
                            alt="Target preview"
                            className="h-full w-auto object-contain"
                          />
                        )
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <span className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald-text)] shadow-sm inline-block">
                        {t('giphySearch.selectedBadge') || 'Média cible'}
                      </span>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)] mt-1 truncate">
                        {targetGif.name}
                      </h4>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
                        {(targetGif.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleTargetRemove}
                    className="w-full sm:w-auto px-4 py-2 bg-[var(--danger-bg)] border border-[var(--danger-border)] hover:bg-[var(--danger-border)]/20 text-[var(--danger-text)] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shrink-0"
                  >
                    {t('common.change') || 'Changer de GIF'}
                  </button>
                </div>
              ) : (
                /* GIF library selector / upload zone */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {t('upload.targetLabel')}
                    </h3>
                  </div>

                  {isGiphyConfigured ? (
                    <>
                      {/* Tabs Header for Giphy vs Custom Upload */}
                      <div className="flex p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg max-w-xs">
                        <button
                          onClick={() => setGiphySearchTab('search')}
                          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            giphySearchTab === 'search'
                              ? 'bg-[var(--bg-primary)] text-[var(--emerald-text)] border border-[var(--border-color)] shadow-sm'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          {t('giphySearch.tabLibrary')}
                        </button>
                        <button
                          onClick={() => setGiphySearchTab('upload')}
                          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            giphySearchTab === 'upload'
                              ? 'bg-[var(--bg-primary)] text-[var(--emerald-text)] border border-[var(--border-color)] shadow-sm'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          {t('giphySearch.tabUpload')}
                        </button>
                      </div>

                      {giphySearchTab === 'search' ? (
                        isGiphyLoading ? (
                          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--border-color)] rounded-xl min-h-[160px] bg-[var(--bg-secondary)]">
                            <Sparkle size={24} className="animate-spin text-[var(--emerald-main)]" />
                            <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">
                              {t('giphySearch.loadingGif') || 'Téléchargement...'}
                            </p>
                          </div>
                        ) : (
                          <GiphySearch
                            onSelect={handleSelectGiphy}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            selectedGifId={null}
                          />
                        )
                      ) : (
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
                      )}
                    </>
                  ) : (
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
                  )}
                </div>
              )}
            </div>

            {/* 2. DYNAMIC WORKSPACE: Centered column or split columns depending on "custom" preset */}
            <div className={preset === 'custom' ? 'grid grid-cols-1 lg:grid-cols-3 gap-8 items-start' : 'w-full'}>
              
              {/* Left Column (or main column) */}
              <div className={preset === 'custom' ? 'lg:col-span-2 space-y-6' : 'space-y-6 w-full'}>
                
                {/* Visage source UploadZone */}
                <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm space-y-5">
                  <UploadZone
                    id="source-upload"
                    label={t('upload.sourceLabel')}
                    accept="image/*"
                    file={null} // Garde toujours la zone de drag-and-drop active
                    previewUrl={null}
                    onChange={handleSourceChange}
                    onRemove={handleSourceRemove}
                    description={t('upload.sourceDesc')}
                    type="image"
                    isProcessing={isProcessing || isSavingHistory}
                  />

                  {/* Aperçu et grille d'historique */}
                  <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        {t('upload.recentFaces') || "Visages récents"}
                      </span>
                      {(sourcePreviewUrl || selectedHistoryFilename) && (
                        <button
                          onClick={handleSourceRemove}
                          className="text-[10px] text-rose-500 hover:text-rose-400 font-medium transition-colors cursor-pointer flex items-center gap-1 active:scale-95 bg-transparent border-0"
                        >
                          {t('common.reset') || "Désélectionner"}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 items-center">
                      {/* Affichage du visage sélectionné (s'il n'est pas déjà dans la liste de l'historique) */}
                      {sourcePreviewUrl && !historyList.some(item => `/api/source-history/${item.filename}` === sourcePreviewUrl || item.filename === selectedHistoryFilename) && (
                        <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-[var(--emerald-main)] shadow-[0_0_10px_var(--emerald-bg)] group bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sourcePreviewUrl}
                            alt="Selected face"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--emerald-main)] rounded-full border border-white flex items-center justify-center text-[10px] text-white font-bold">
                            ✓
                          </div>
                        </div>
                      )}

                      {historyList.length === 0 ? (
                        <div className="col-span-full py-4 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/30 rounded-xl border border-dashed border-[var(--border-subtle)]">
                          {t('upload.noHistory') || "Aucun visage récent."}
                        </div>
                      ) : (
                        historyList.map((item) => {
                          const isSelected = selectedHistoryFilename === item.filename || sourcePreviewUrl === `/api/source-history/${item.filename}`;
                          return (
                            <button
                              key={item.filename}
                              onClick={() => handleSelectFromHistory(item.filename)}
                              type="button"
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 group bg-[var(--bg-secondary)] flex items-center justify-center cursor-pointer hover:scale-[1.03] ${
                                isSelected
                                  ? 'border-[var(--emerald-main)] shadow-[0_0_12px_var(--emerald-bg)]'
                                  : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.url}
                                alt={`Face ${item.filename}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--emerald-main)] rounded-full border border-[var(--bg-primary)] flex items-center justify-center text-[9px] text-white font-bold shadow-sm">
                                  ✓
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Preset Quality Selector */}
                <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                      {t('model.presets.title')}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {t('model.presets.subtitle')}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 p-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl">
                    {(['low', 'medium', 'high', 'custom'] as const).map((p) => {
                      const isActive = preset === p;
                      return (
                        <button
                          key={p}
                          onClick={() => {
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
                          }}
                          type="button"
                          className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer capitalize text-center ${
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

                {/* Generate Button */}
                <button
                  onClick={handleSubmit}
                  disabled={(!sourceImage && !selectedHistoryFilename) || !targetGif || isProcessing}
                  className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    (!sourceImage && !selectedHistoryFilename) || !targetGif || isProcessing
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                      : 'bg-[var(--emerald-main)] hover:bg-emerald-600 text-white shadow-md active:scale-[0.98]'
                  }`}
                >
                  <ArrowsLeftRight size={18} weight="bold" />
                  {isProcessing ? `${t('page.processing')}` : t('page.startSwap')}
                </button>

                {/* Tips & Welcome Container */}
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

              {/* Right Column: Custom settings details panel */}
              {preset === 'custom' && (
                <div className="lg:col-span-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
                    <div className="p-1.5 bg-[var(--emerald-bg)] text-[var(--emerald-text)] rounded-lg">
                      <Gear size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        {t('model.title')}
                      </h3>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
                        {t('model.subtitle')}
                      </p>
                    </div>
                  </div>
                  <ModelSettings
                    flatMode={true}
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
                    preset={preset}
                    setPreset={setPreset}
                    faceEnhancerBlend={faceEnhancerBlend}
                    setFaceEnhancerBlend={setFaceEnhancerBlend}
                    frameEnhancerModel={frameEnhancerModel}
                    setFrameEnhancerModel={setFrameEnhancerModel}
                    expressionRestorerModel={expressionRestorerModel}
                    setExpressionRestorerModel={setExpressionRestorerModel}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Status / Process Section */}
        <AnimatePresence mode="wait">
          {(isProcessing || result) && (
            <motion.div
              key="status-section"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full space-y-6 pt-6 border-t border-[var(--border-subtle)]"
            >
              
              
              {/* Stepper Component */}
              <div ref={processStepsRef} className="scroll-mt-24">
                <ProcessSteps steps={steps} currentStepIndex={currentStepIndex} faceswapProgress={faceswapProgress} />
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => {
          checkGiphyConfiguration();
        }}
      />
    </main>
  );
}

