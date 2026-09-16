import { ElectronAPI } from '../types/ipc';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
