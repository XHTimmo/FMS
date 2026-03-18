import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const wrapped = (_event: unknown, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
