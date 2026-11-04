export interface ElectronAPI {
  platform: string;
  isMac: boolean;
  sendNewNote: (callback: () => void) => void;
  sendSearch: (callback: () => void) => void;
  sendCheckUpdates: (callback: () => void) => void;
  installUpdate?: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateProgress?: (callback: (percent: number) => void) => () => void;
}

declare global {
  const __APP_VERSION__: string;
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

