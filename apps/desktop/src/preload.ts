import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { FaceswapOptions } from '@meme-swap/faceswap-core';

// Subset of FaceswapOptions that the renderer is allowed to configure over
// IPC: source/target media come across as either an existing path (string,
// e.g. a `history:<filename>` reference) or raw file bytes (Uint8Array),
// never as the pre-resolved sourcePath/targetPath/outputPath that
// faceswap-core's runFaceSwap() expects — those are computed on the main
// process side (see main.ts's `run-faceswap` handler) before delegating to
// runFaceSwap(). onProgress/onProcessStart are likewise wired up internally
// and are not something the renderer supplies.
type FaceswapProcessingOptions = Pick<
  FaceswapOptions,
  | 'executionProviders'
  | 'faceSelectorMode'
  | 'threadCount'
  | 'logLevel'
  | 'faceMaskBlend'
  | 'faceSwapperModel'
  | 'faceEnhancerModel'
  | 'faceEnhancerBlend'
  | 'frameEnhancerModel'
  | 'expressionRestorerModel'
  | 'lipSyncerModel'
>;

interface RunFaceswapOptions extends FaceswapProcessingOptions {
  source: string | Uint8Array;
  sourceName?: string;
  target: string | Uint8Array;
  targetName?: string;
}

interface GiphySearchOptions {
  query: string;
  limit?: number;
  offset?: number;
}

interface GiphyTrendingOptions {
  limit?: number;
  offset?: number;
}

// Expose APIs to the renderer (setup.html)
contextBridge.exposeInMainWorld('electronAPI', {
  // Setup APIs
  startSetup: () => ipcRenderer.send('start-setup'),
  onProgress: (
    callback: (
      event: IpcRendererEvent,
      data: { step: string; status: 'active' | 'completed' | 'failed'; percent: number },
    ) => void,
  ) => {
    ipcRenderer.on('setup-progress', callback);
  },
  onLog: (callback: (event: IpcRendererEvent, text: string) => void) => {
    ipcRenderer.on('setup-log', callback);
  },
  onFinished: (callback: (event: IpcRendererEvent, success: boolean) => void) => {
    ipcRenderer.on('setup-finished', callback);
  },
  getSetupPreflight: () => ipcRenderer.invoke('get-setup-preflight'),
  // Whether FaceFusion is already installed: lets the unified setup screen
  // (setup.html) pre-mark the install steps as done and jump straight to the
  // initialization step instead of showing a separate loading screen.
  getInstallState: () => ipcRenderer.invoke('get-install-state'),

  // Server startup APIs (initialization step of the setup screen)
  loadingReady: () => ipcRenderer.send('loading-ready'),
  onServerLog: (callback: (event: IpcRendererEvent, text: string) => void) => {
    ipcRenderer.on('server-log', callback);
  },
  onServerStatus: (
    callback: (event: IpcRendererEvent, status: { mcp: string; frontend: string }) => void,
  ) => {
    ipcRenderer.on('server-status', callback);
  },
  quitApp: () => ipcRenderer.send('quit-app'),

  // Faceswap & MCP APIs
  runFaceswap: (options: RunFaceswapOptions) => ipcRenderer.invoke('run-faceswap', options),
  onFaceswapProgress: (
    callback: (event: IpcRendererEvent, data: { step: string; percent: number }) => void,
  ) => {
    const listener = (event: IpcRendererEvent, data: { step: string; percent: number }) =>
      callback(event, data);
    ipcRenderer.on('faceswap-progress', listener);
    return () => {
      ipcRenderer.removeListener('faceswap-progress', listener);
    };
  },
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
  isGiphyConfigured: () => ipcRenderer.invoke('is-giphy-configured'),
  searchGiphy: (options: GiphySearchOptions) => ipcRenderer.invoke('search-giphy', options),
  getTrendingGiphy: (options: GiphyTrendingOptions) =>
    ipcRenderer.invoke('get-trending-giphy', options),
  getSourceHistory: () => ipcRenderer.invoke('get-source-history'),
  saveSourceFace: (options: { path?: string; data?: Uint8Array; name: string }) =>
    ipcRenderer.invoke('save-source-face', options),
  deleteSourceFace: (filename: string) => ipcRenderer.invoke('delete-source-face', filename),
  getResultsHistory: () => ipcRenderer.invoke('get-results-history'),
  deleteResult: (filename: string) => ipcRenderer.invoke('delete-result', filename),
  clearResultsHistory: () => ipcRenderer.invoke('clear-results-history'),

  // Update check APIs
  onUpdateAvailable: (
    callback: (event: IpcRendererEvent, data: { version: string; url: string }) => void,
  ) => {
    ipcRenderer.on('update-available', callback);
  },
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
});
