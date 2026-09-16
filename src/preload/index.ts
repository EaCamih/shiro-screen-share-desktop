import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, DeepLinkParams } from '../types/ipc';
import { WindowSource, AudioCaptureConfig } from '../types/capture';
import { AudioCaptureStatus } from '../types/audio';

const api: ElectronAPI = {
  getAvailableSources: (): Promise<WindowSource[]> => {
    return ipcRenderer.invoke('get-available-sources');
  },

  startAudioCapture: (config: AudioCaptureConfig): Promise<AudioCaptureStatus> => {
    return ipcRenderer.invoke('start-audio-capture', config);
  },

  stopAudioCapture: (): Promise<void> => {
    return ipcRenderer.invoke('stop-audio-capture');
  },

  fetchLiveKitToken: (
    backendUrl: string,
    roomName: string,
    identity: string,
    userName?: string
  ): Promise<string> => {
    return ipcRenderer.invoke('fetch-livekit-token', backendUrl, roomName, identity, userName);
  },

  getResourcesPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-resources-path');
  },

  minimizeWindow: (): void => {
    ipcRenderer.send('window-minimize');
  },

  maximizeWindow: (): void => {
    ipcRenderer.send('window-maximize');
  },

  closeWindow: (): void => {
    ipcRenderer.send('window-close');
  },

  onProcessAudioData: (callback: (buffer: ArrayBuffer) => void) => {
    const listener = (_event: any, buffer: ArrayBuffer) => callback(buffer);
    ipcRenderer.on('process-audio-data', listener);
    return () => ipcRenderer.removeListener('process-audio-data', listener);
  },

  onDeepLinkReceived: (callback: (params: DeepLinkParams) => void) => {
    const listener = (_event: any, params: DeepLinkParams) => callback(params);
    ipcRenderer.on('deep-link', listener);
    return () => ipcRenderer.removeListener('deep-link', listener);
  },

  onAudioCaptureError: (callback: (errorMsg: string) => void) => {
    const listener = (_event: any, errorMsg: string) => callback(errorMsg);
    ipcRenderer.on('audio-capture-error', listener);
    return () => ipcRenderer.removeListener('audio-capture-error', listener);
  },
};

try {
  contextBridge.exposeInMainWorld('api', api);
} catch (err) {
  console.error('[Preload] Failed to expose window.api contextBridge:', err);
}
