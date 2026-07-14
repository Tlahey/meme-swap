'use client';

import React, { useState } from 'react';
import {
  TerminalIcon as Terminal,
  CopyIcon as Copy,
  CheckIcon as Check,
  InfoIcon as Info,
  CpuIcon as Cpu,
  CodeIcon as Code,
} from '@phosphor-icons/react';
import { useTranslation } from '@meme-swap/i18n';

interface McpSettingsProps {
  isMcpActive: boolean | null;
  mcpPort: string;
}

export function McpSettings({ isMcpActive, mcpPort }: McpSettingsProps) {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const { t } = useTranslation();

  const configPath = '~/Library/Application Support/Claude/claude_desktop_config.json';

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        'meme-swap': {
          url: `http://127.0.0.1:${mcpPort}/mcp`,
        },
      },
    },
    null,
    2,
  );

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(configPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfig);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-5 space-y-5 shadow-sm transition-all">
      {/* Header Statut */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--emerald-bg)] border border-[var(--emerald-border)] text-[var(--emerald-text)] rounded-lg">
            <Cpu size={18} weight="bold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('mcp.title')}</h3>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t('mcp.subtitle')}</p>
          </div>
        </div>

        {/* Badge de Statut */}
        <div className="flex items-center gap-2">
          {isMcpActive === null ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
              {t('mcp.checking')}
            </span>
          ) : isMcpActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--emerald-bg)] text-[var(--emerald-text)] border border-[var(--emerald-border)] shadow-[0_0_8px_rgba(16,185,129,0.15)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--emerald-main)]"></span>
              {t('mcp.active', { port: mcpPort })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {t('mcp.inactive')}
            </span>
          )}
        </div>
      </div>

      {/* Description générale */}
      <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-2">
        <p>{t('mcp.desc1')}</p>
        <p className="text-[11px] text-[var(--text-muted)] flex items-start gap-1.5">
          <Info size={14} className="text-[var(--emerald-main)] shrink-0 mt-0.5" />
          <span>{t('mcp.desc2')}</span>
        </p>
      </div>

      {/* Guide Claude Desktop */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--emerald-main)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('mcp.claudeConnect')}
          </span>
        </div>

        <div className="space-y-4">
          {/* Étape 1 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--text-primary)] block">
              {t('mcp.step1')}
            </span>
            <div className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[10px] font-mono text-[var(--text-secondary)]">
              <span className="truncate select-all pr-2">{configPath}</span>
              <button
                onClick={handleCopyPath}
                className="p-1 hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded transition-colors text-[var(--text-muted)] shrink-0"
                title={t('mcp.copy')}
              >
                {copiedPath ? (
                  <Check size={14} className="text-[var(--emerald-main)]" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Étape 2 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--text-primary)] block">
              {t('mcp.step2')}
            </span>
            <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
              <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
                <span>mcp_config.json</span>
                <button
                  onClick={handleCopyConfig}
                  className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                >
                  {copiedConfig ? (
                    <>
                      <Check size={12} className="text-[var(--emerald-main)]" />
                      <span>{t('mcp.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>{t('mcp.copy')}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto leading-relaxed select-all">
                {mcpConfig}
              </pre>
            </div>
          </div>

          {/* Étape 3 */}
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)]">
            <div className="flex items-start gap-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
              <Code size={14} className="text-[var(--emerald-main)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--text-secondary)] font-semibold">
                  {t('mcp.instructionExample')}
                </strong>
                <p className="mt-0.5 italic">{t('mcp.exampleText')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
