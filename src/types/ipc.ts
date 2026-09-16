import { WindowSource, AudioCaptureConfig, StreamStartParams } from './capture';
import { AudioCaptureStatus } from './audio';

export interface DeepLinkParams {
  roomName?: string;
  identity?: string;
  userName?: string;
  backendUrl?: string;
  livekitUrl?: string;
  [key: string]: string | undefined;
}

export interface ElectronAPI {
  // Main Process Invocations (Renderer -> Main -> Renderer)
  getAvailableSources: () => Promise<WindowSource[]>;
  startAudioCapture: (config: AudioCaptureConfig) => Promise<AudioCaptureStatus>;
  stopAudioCapture: () => Promise<void>;
  fetchLiveKitToken: (backendUrl: string, roomName: string, identity: string, userName?: string) => Promise<string>;
  getResourcesPath: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;

  // Push Event Listeners (Main -> Renderer)
  onProcessAudioData: (callback: (buffer: ArrayBuffer) => void) => () => void;
  onDeepLinkReceived: (callback: (params: DeepLinkParams) => void) => () => void;
  onAudioCaptureError: (callback: (errorMsg: string) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

