export interface ElectronAPI {
  platform: string;
  isMac: boolean;
  sendNewNote: (callback: () => void) => void;
  sendSearch: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
