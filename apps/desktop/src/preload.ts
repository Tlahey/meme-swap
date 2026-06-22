import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to the renderer (setup.html)
contextBridge.exposeInMainWorld('electronAPI', {
  // Setup APIs
  startSetup: () => ipcRenderer.send('start-setup'),
  onProgress: (callback: (event: any, data: { step: string; status: 'active' | 'completed' | 'failed'; percent: number }) => void) => {
    ipcRenderer.on('setup-progress', callback);
  },
  onLog: (callback: (event: any, text: string) => void) => {
    ipcRenderer.on('setup-log', callback);
  },
  onFinished: (callback: (event: any, success: boolean) => void) => {
    ipcRenderer.on('setup-finished', callback);
  },

  // Loading APIs
  loadingReady: () => ipcRenderer.send('loading-ready'),
  onServerLog: (callback: (event: any, text: string) => void) => {
    ipcRenderer.on('server-log', callback);
  },
  onServerStatus: (callback: (event: any, status: { mcp: string; frontend: string }) => void) => {
    ipcRenderer.on('server-status', callback);
  },
  quitApp: () => ipcRenderer.send('quit-app')
});
