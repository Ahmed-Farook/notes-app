import { useState, useEffect, useCallback } from 'react';
import {
  UpdateInfo,
  checkForUpdates as fetchUpdates,
  CURRENT_VERSION,
} from '../utils/updateChecker';

export function useAppUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const runCheck = useCallback(async (token?: string, isManual = false) => {
    setIsChecking(true);
    setError(null);
    try {
      const info = await fetchUpdates(token);
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setIsBannerDismissed(false);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to check for updates';
      setError(msg);
      // Only keep update info null if it's an error
      setUpdateInfo(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Background check on startup (delayed 2 seconds to keep startup instant)
  useEffect(() => {
    const timer = setTimeout(() => {
      runCheck(undefined, false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [runCheck]);

  // Listen to native macOS Menu item "Check for Updates..."
  useEffect(() => {
    if (window.electronAPI?.sendCheckUpdates) {
      window.electronAPI.sendCheckUpdates(() => {
        setIsModalOpen(true);
        runCheck(undefined, true);
      });
    }
  }, [runCheck]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    if (!updateInfo && !isChecking) {
      runCheck(undefined, true);
    }
  }, [updateInfo, isChecking, runCheck]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
  }, []);

  return {
    currentVersion: CURRENT_VERSION,
    updateInfo,
    isChecking,
    error,
    isModalOpen,
    isBannerVisible: Boolean(updateInfo?.hasUpdate && !isBannerDismissed),
    openModal,
    closeModal,
    dismissBanner,
    checkAgain: (token?: string) => runCheck(token, true),
  };
}

