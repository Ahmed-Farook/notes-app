export interface ElectronAPI {
  platform: string;
  isMac: boolean;
  sendNewNote: (callback: () => void) => void;
  sendSearch: (callback: () => void) => void;
  sendCheckUpdates: (callback: () => void) => void;
}

declare global {
  const __APP_VERSION__: string;
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

