import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from './contracts';

const bridge: DesktopBridge = {
  platform: 'desktop',
  readState: (locale) => ipcRenderer.invoke('cemetery:read', locale),
  saveState: (state, locale) => ipcRenderer.invoke('cemetery:save', state, locale),
  scan: (input) => ipcRenderer.invoke('cemetery:scan', input),
  chooseDirectory: (locale) => ipcRenderer.invoke('cemetery:choose-directory', locale),
  credentialStatus: (locale) => ipcRenderer.invoke('cemetery:credential-status', locale),
  saveCredential: (token, locale) => ipcRenderer.invoke('cemetery:credential-save', token, locale),
  savePoster: (bytes, filename, locale) =>
    ipcRenderer.invoke('cemetery:save-poster', bytes, filename, locale),
};
contextBridge.exposeInMainWorld('cemeteryDesktop', Object.freeze(bridge));
