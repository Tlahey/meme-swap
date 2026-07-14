'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  CheckIcon as Check,
  CircleNotchIcon as CircleNotch,
  DownloadSimpleIcon as DownloadSimple,
  TerminalWindowIcon as TerminalWindow,
  WarningIcon as Warning,
  WrenchIcon as Wrench,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

type SetupStepId =
  'system-checks' | 'clone-repo' | 'setup-venv' | 'install-deps' | 'verify-install';
type SetupStepStatus = 'idle' | 'active' | 'completed' | 'failed';

interface ProgressEventData {
  step: SetupStepId;
  status: 'active' | 'completed' | 'failed';
  percent: number;
}

export interface DiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  meetsMinimum: boolean;
}

interface SetupWizardProps {
  onComplete: () => void;
  diskSpace?: DiskSpaceInfo | null;
}

const IDLE_STATUSES: Record<SetupStepId, SetupStepStatus> = {
  'system-checks': 'idle',
  'clone-repo': 'idle',
  'setup-venv': 'idle',
  'install-deps': 'idle',
  'verify-install': 'idle',
};

function formatGb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export function SetupWizard({ onComplete, diskSpace }: SetupWizardProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

  const [stepStatuses, setStepStatuses] =
    useState<Record<SetupStepId, SetupStepStatus>>(IDLE_STATUSES);
  const [percent, setPercent] = useState(0);
  const [logs, setLogs] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const stepDefs: { id: SetupStepId; label: string; desc: string }[] = [
    {
      id: 'system-checks',
      label: t('setup.steps.systemChecks.label'),
      desc: t('setup.steps.systemChecks.desc'),
    },
    {
      id: 'clone-repo',
      label: t('setup.steps.cloneRepo.label'),
      desc: t('setup.steps.cloneRepo.desc'),
    },
    {
      id: 'setup-venv',
      label: t('setup.steps.setupVenv.label'),
      desc: t('setup.steps.setupVenv.desc'),
    },
    {
      id: 'install-deps',
      label: t('setup.steps.installDeps.label'),
      desc: t('setup.steps.installDeps.desc'),
    },
    {
      id: 'verify-install',
      label: t('setup.steps.verifyInstall.label'),
      desc: t('setup.steps.verifyInstall.desc'),
    },
  ];

  const handleStart = () => {
    eventSourceRef.current?.close();

    setHasStarted(true);
    setHasFailed(false);
    setIsRunning(true);
    setLogs('');
    setPercent(0);
    setStepStatuses(IDLE_STATUSES);

    const eventSource = new EventSource('/api/setup/install');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as ProgressEventData;
      setStepStatuses((prev) => ({ ...prev, [data.step]: data.status }));
      setPercent(data.percent);
      if (data.status === 'failed') {
        setHasFailed(true);
      }
    });

    eventSource.addEventListener('log', (event) => {
      const text = JSON.parse((event as MessageEvent<string>).data) as string;
      setLogs((prev) => prev + text);
    });

    eventSource.addEventListener('done', (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { success: boolean };
      setIsRunning(false);
      eventSource.close();
      if (data.success) {
        setPercent(100);
        setTimeout(() => onComplete(), 800);
      } else {
        setHasFailed(true);
      }
    });

    eventSource.onerror = () => {
      setIsRunning(false);
      setHasFailed(true);
      eventSource.close();
    };
  };

  const statusText = !hasStarted
    ? t('setup.readyStatus')
    : isRunning
      ? t('setup.runningStatus')
      : hasFailed
        ? t('setup.failedStatus')
        : t('setup.successStatus');

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[900px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-6 md:p-8 flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] rounded-xl text-[var(--emerald-text)] shrink-0">
            <Wrench size={20} weight="fill" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{t('setup.title')}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              {t('setup.subtitle')}
            </p>
          </div>
        </div>

        {/* Steps + Terminal */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <div className="flex flex-col gap-2 md:border-r md:border-[var(--border-subtle)] md:pr-6">
            {stepDefs.map((step, idx) => {
              const status = stepStatuses[step.id];
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors duration-200 ${
                    status === 'active'
                      ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)]'
                      : status === 'failed'
                        ? 'bg-[var(--danger-bg)] border-[var(--danger-border)]'
                        : 'bg-transparent border-transparent'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                      status === 'completed'
                        ? 'bg-[var(--emerald-main)] text-white'
                        : status === 'active'
                          ? 'border-2 border-[var(--emerald-main)] text-[var(--emerald-main)]'
                          : status === 'failed'
                            ? 'bg-[var(--danger-text)] text-white'
                            : 'border-2 border-[var(--border-color)] text-[var(--text-muted)]'
                    }`}
                  >
                    {status === 'completed' ? (
                      <Check size={12} weight="bold" />
                    ) : status === 'active' ? (
                      <motion.div
                        animate={shouldReduceMotion ? {} : { rotate: 360 }}
                        transition={
                          shouldReduceMotion
                            ? {}
                            : { repeat: Infinity, duration: 1, ease: 'linear' }
                        }
                      >
                        <CircleNotch size={12} weight="bold" />
                      </motion.div>
                    ) : status === 'failed' ? (
                      <span className="font-bold text-[10px]">!</span>
                    ) : (
                      <span className="font-bold text-[10px]">{idx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        status === 'active'
                          ? 'text-[var(--emerald-text)]'
                          : status === 'failed'
                            ? 'text-[var(--danger-text)]'
                            : status === 'completed'
                              ? 'text-[var(--text-secondary)]'
                              : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-wider">
              <TerminalWindow size={14} />
              {t('setup.logsTitle')}
            </div>
            <pre
              ref={logRef}
              className="flex-1 overflow-y-auto p-4 text-[11px] font-mono leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-all h-[280px] max-h-[280px] m-0"
            >
              {logs || t('setup.waitingLogs')}
            </pre>
          </div>
        </div>

        {/* Progress + Action */}
        <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5">
          <div className="w-full h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${hasFailed ? 'bg-[var(--danger-text)]' : 'bg-[var(--emerald-main)]'}`}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p
              className={`text-xs font-medium ${hasFailed ? 'text-[var(--danger-text)]' : 'text-[var(--text-muted)]'}`}
            >
              {statusText}
            </p>
            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-2 shrink-0 ${
                isRunning
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'bg-[var(--emerald-main)] hover:bg-emerald-600 text-white shadow-md'
              }`}
            >
              {isRunning ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <DownloadSimple size={14} weight="bold" />
              )}
              {hasFailed ? t('setup.retryButton') : t('setup.startButton')}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            {t('setup.sizeEstimate')}
          </p>
          {diskSpace && !diskSpace.meetsMinimum && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Warning size={14} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                {t('setup.diskWarning', { free: `${formatGb(diskSpace.freeBytes)} GB` })}
              </p>
            </div>
          )}
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            {t('setup.footerNote')}
          </p>
        </div>
      </motion.div>
    </main>
  );
}
