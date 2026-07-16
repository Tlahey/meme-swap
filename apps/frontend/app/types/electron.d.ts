import type { FaceswapOptions, FaceswapResult } from '@meme-swap/faceswap-core';

/**
 * Subset of FaceswapOptions the renderer is allowed to configure over IPC —
 * mirrors apps/desktop/src/preload.ts's `FaceswapProcessingOptions` exactly
 * (same `Pick`, against the same shared-package type). apps/frontend can't
 * import that type directly since apps shouldn't depend on other apps, so
 * it's redeclared here by hand.
 */
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

/** Mirrors preload.ts's `RunFaceswapOptions`. */
interface RunFaceswapOptions extends FaceswapProcessingOptions {
  source: string | Uint8Array;
  sourceName?: string;
  target: string | Uint8Array;
  targetName?: string;
}

interface HistoryItem {
  filename: string;
  url: string;
  timestamp: number;
}

/** Return shape of getSourceHistory/getResultsHistory (preload.ts). */
interface HistoryResult {
  success: boolean;
  history?: HistoryItem[];
}

/** Return shape of deleteResult/clearResultsHistory/deleteSourceFace (preload.ts). */
interface DeleteResultResponse {
  success: boolean;
  error?: string;
}

/**
 * Return shape of saveSourceFace (preload.ts / main.ts's save-source-face
 * handler) — a discriminated union on `success`, matching main.ts exactly:
 * the success branch always returns `savedFilename`+`history`, the catch
 * branch always returns `error`, never a mix of both.
 */
type SaveSourceFaceResult =
  | { success: true; savedFilename: string; history: HistoryItem[] }
  | { success: false; error: string };

/** Return shape of getMcpStatus (preload.ts / main.ts's get-mcp-status handler). */
interface McpStatus {
  active: boolean;
  port: string;
}

/**
 * Subset of the `window.electronAPI` bridge (apps/desktop/src/preload.ts,
 * exposed via contextBridge.exposeInMainWorld) that apps/frontend actually
 * calls. The real bridge has a larger surface (setup/loading-window only
 * APIs this Next.js app never renders), but apps/frontend can't import
 * apps/desktop's types (apps shouldn't depend on other apps), so method
 * signatures are mirrored by hand here against preload.ts's real
 * implementation — the same narrowing approach packages/api-client's
 * `ElectronGiphyBridge` already takes for its own 2-method slice.
 *
 * Every method is optional because callers always guard with
 * `typeof electronAPI.method === 'function'` before calling (defensive
 * against a stale/partial bridge), matching the existing call sites.
 */
export interface ElectronAPI {
  /** preload.ts: `getSourceHistory: () => ipcRenderer.invoke('get-source-history')` */
  getSourceHistory?: () => Promise<HistoryResult>;
  /** preload.ts: `saveSourceFace: (options: { path?: string; data?: Uint8Array; name: string }) => ...` */
  saveSourceFace?: (options: {
    path?: string;
    data?: Uint8Array;
    name: string;
  }) => Promise<SaveSourceFaceResult>;
  /** preload.ts: `deleteSourceFace: (filename: string) => ipcRenderer.invoke('delete-source-face', filename)` */
  deleteSourceFace?: (filename: string) => Promise<DeleteResultResponse>;
  /** preload.ts: `getResultsHistory: () => ipcRenderer.invoke('get-results-history')` */
  getResultsHistory?: () => Promise<HistoryResult>;
  /** preload.ts: `deleteResult: (filename: string) => ipcRenderer.invoke('delete-result', filename)` */
  deleteResult?: (filename: string) => Promise<DeleteResultResponse>;
  /** preload.ts: `clearResultsHistory: () => ipcRenderer.invoke('clear-results-history')` */
  clearResultsHistory?: () => Promise<DeleteResultResponse>;
  /** preload.ts: `isGiphyConfigured: () => ipcRenderer.invoke('is-giphy-configured')` */
  isGiphyConfigured?: () => Promise<boolean>;
  /** preload.ts: `getMcpStatus: () => ipcRenderer.invoke('get-mcp-status')` */
  getMcpStatus?: () => Promise<McpStatus>;
  /** preload.ts: `runFaceswap: (options: RunFaceswapOptions) => ipcRenderer.invoke('run-faceswap', options)` */
  runFaceswap?: (options: RunFaceswapOptions) => Promise<FaceswapResult>;
  /**
   * preload.ts: `onFaceswapProgress: (callback) => { ipcRenderer.on(...); return () => ipcRenderer.removeListener(...) }`
   * `event` is typed `unknown` rather than Electron's `IpcRendererEvent` —
   * apps/frontend is browser-first and doesn't depend on `electron`.
   */
  onFaceswapProgress?: (
    callback: (event: unknown, data: { step: string; percent: number }) => void,
  ) => () => void;
  /** preload.ts: `onUpdateAvailable: (callback) => { ipcRenderer.on('update-available', callback) }` */
  onUpdateAvailable?: (
    callback: (event: unknown, data: { version: string; url: string }) => void,
  ) => void;
  /** preload.ts: `openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url)` */
  openExternalUrl?: (url: string) => Promise<void>;
}

/**
 * Electron's renderer process adds a non-standard `.path` property to
 * native `File` objects sourced from drag-and-drop or `<input type="file">`
 * (giving direct filesystem access instead of requiring an in-memory read),
 * which isn't part of the standard DOM `File` type.
 */
export interface ElectronFile extends File {
  path?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
