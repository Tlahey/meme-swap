'use client';

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckIcon as Check, CpuIcon as Cpu } from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

export interface Step {
  id: number;
  label: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  icon: React.ComponentType<{
    size: number;
    className?: string;
    weight?: 'light' | 'regular' | 'bold' | 'fill';
  }>;
}

interface ProcessStepsProps {
  steps: Step[];
  currentStepIndex: number;
  faceswapProgress?: { step: string; percent: number } | null;
}

export function ProcessSteps({ steps, currentStepIndex, faceswapProgress }: ProcessStepsProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();

  const inferencePercent = (currentStepIndex === 2 && faceswapProgress) ? faceswapProgress.percent : 0;
  const progressPercent = Math.min(
    Math.round(((currentStepIndex + (inferencePercent / 100)) / steps.length) * 100),
    100,
  );

  return (
    <div className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('process.title')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('process.subtitle')}
            </p>
          </div>
          <span className="text-xs px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-full font-mono font-medium tabular-nums">
            {progressPercent}%
          </span>
        </div>

        {/* Stepper items */}
        <div className="relative flex flex-col gap-5">
          {/* Vertical progress bar line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-[var(--border-color)]" />

          {/* Animated active path line */}
          <motion.div
            className="absolute left-[15px] top-4 w-[2px] bg-[var(--emerald-main)] origin-top"
            initial={{ scaleY: 0 }}
            animate={{
              scaleY: Math.min(currentStepIndex / (steps.length - 1), 1),
            }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
            style={{ height: 'calc(100% - 32px)' }}
          />

          {steps.map((step, idx) => {
            const isCompleted =
              step.status === 'completed' || idx < currentStepIndex;
            const isRunning =
              step.status === 'running' || idx === currentStepIndex;
            const isFailed = step.status === 'failed';
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex gap-4 relative items-start">
                {/* Node representation */}
                <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-[var(--bg-primary)]">
                  {isCompleted ? (
                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { scale: 0.8, opacity: 0 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                      className="flex items-center justify-center w-full h-full rounded-full bg-[var(--emerald-main)] text-white shadow-sm"
                    >
                      <Check size={14} weight="bold" />
                    </motion.div>
                  ) : isRunning ? (
                    <div className="flex items-center justify-center w-full h-full rounded-full bg-[var(--bg-primary)] border-2 border-[var(--emerald-main)] text-[var(--emerald-main)]">
                      <motion.div
                        animate={shouldReduceMotion ? {} : { rotate: 360 }}
                        transition={
                          shouldReduceMotion
                            ? {}
                            : { repeat: Infinity, duration: 2, ease: 'linear' }
                        }
                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--emerald-main)] border-r-[var(--emerald-main)] opacity-80"
                      />
                      <Icon size={14} className="relative z-10" />
                    </div>
                  ) : isFailed ? (
                    <div className="flex items-center justify-center w-full h-full rounded-full bg-[var(--danger-bg)] border-2 border-[var(--danger-text)] text-[var(--danger-text)]">
                      <span className="font-bold text-xs">!</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)] text-[var(--text-muted)]">
                      <Icon size={14} weight="bold" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 pt-1">
                  <h4
                    className={`text-sm font-semibold transition-colors duration-200 ${
                      isRunning
                        ? 'text-[var(--emerald-main)]'
                        : isCompleted
                          ? 'text-[var(--text-primary)]'
                          : isFailed
                            ? 'text-[var(--danger-text)]'
                            : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {step.label}
                  </h4>
                  <p
                    className={`text-xs mt-1 leading-relaxed transition-colors duration-200 ${
                      isRunning
                        ? 'text-[var(--text-secondary)]'
                        : isCompleted
                          ? 'text-[var(--text-muted)]'
                          : isFailed
                            ? 'text-[var(--danger-text)]'
                            : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {idx === 2 && faceswapProgress && isRunning ? (
                      <span className="font-semibold text-[var(--emerald-main)]">
                        {t(`process.progress.${faceswapProgress.step}`)} : {faceswapProgress.percent}%
                      </span>
                    ) : (
                      step.description
                    )}
                  </p>
                  {idx === 2 && faceswapProgress && isRunning && (
                    <div className="mt-2 w-full max-w-md">
                      <div className="w-full h-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--emerald-main)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${faceswapProgress.percent}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Apple Silicon note when in inference step */}
        <AnimatePresence>
          {currentStepIndex === 2 && (
            <motion.div
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -5, height: 0 }
              }
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
              className="overflow-hidden"
            >
              <div className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg p-3 flex gap-3 items-start leading-relaxed mt-2">
                <Cpu
                  size={16}
                  className="text-[var(--emerald-main)] shrink-0 mt-0.5"
                />
                <span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    {t('process.note')}
                  </span>{' '}
                  {t('process.noteDesc')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
