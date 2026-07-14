import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to the renderer (setup.html)
contextBridge.exposeInMainWorld('electronAPI', {
  // Setup APIs
  startSetup: () => ipcRenderer.send('start-setup'),
  onProgress: (
    callback: (
      event: any,
      data: { step: string; status: 'active' | 'completed' | 'failed'; percent: number },
    ) => void,
  ) => {
    ipcRenderer.on('setup-progress', callback);
  },
  onLog: (callback: (event: any, text: string) => void) => {
    ipcRenderer.on('setup-log', callback);
  },
  onFinished: (callback: (event: any, success: boolean) => void) => {
    ipcRenderer.on('setup-finished', callback);
  },
  getSetupPreflight: () => ipcRenderer.invoke('get-setup-preflight'),

  // Loading APIs
  loadingReady: () => ipcRenderer.send('loading-ready'),
  onServerLog: (callback: (event: any, text: string) => void) => {
    ipcRenderer.on('server-log', callback);
  },
  onServerStatus: (callback: (event: any, status: { mcp: string; frontend: string }) => void) => {
    ipcRenderer.on('server-status', callback);
  },
  quitApp: () => ipcRenderer.send('quit-app'),

  // Faceswap & MCP APIs
  runFaceswap: (options: any) => ipcRenderer.invoke('run-faceswap', options),
  onFaceswapProgress: (callback: (event: any, data: { step: string; percent: number }) => void) => {
    const listener = (event: any, data: { step: string; percent: number }) => callback(event, data);
    ipcRenderer.on('faceswap-progress', listener);
    return () => {
      ipcRenderer.removeListener('faceswap-progress', listener);
    };
  },
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
  isGiphyConfigured: () => ipcRenderer.invoke('is-giphy-configured'),
  searchGiphy: (options: any) => ipcRenderer.invoke('search-giphy', options),
  getTrendingGiphy: (options: any) => ipcRenderer.invoke('get-trending-giphy', options),
  getSourceHistory: () => ipcRenderer.invoke('get-source-history'),
  saveSourceFace: (options: { path?: string; data?: Uint8Array; name: string }) =>
    ipcRenderer.invoke('save-source-face', options),
  getResultsHistory: () => ipcRenderer.invoke('get-results-history'),

  // Update check APIs
  onUpdateAvailable: (callback: (event: any, data: { version: string; url: string }) => void) => {
    ipcRenderer.on('update-available', callback);
  },
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
});
