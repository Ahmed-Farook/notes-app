import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
  Key,
  Zap,
} from 'lucide-react';
import { TexoLogo } from '../common/TexoLogo';
import {
  UpdateInfo,
  CURRENT_VERSION,
  getStoredGithubToken,
  setStoredGithubToken,
  checkForUpdates,
} from '../../utils/updateChecker';
import { triggerHaptic } from '../../utils/haptics';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  error: string | null;
  onCheckAgain: (token?: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking,
  error,
  onCheckAgain,
}) => {
  const [tokenInput, setTokenInput] = useState(() => getStoredGithubToken() || '');
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI?.onUpdateProgress) {
      const unsubscribe = window.electronAPI.onUpdateProgress((percent) => {
        setInstallProgress(percent);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleInstallNow = async () => {
    if (!updateInfo) return;
    setIsInstalling(true);
    setInstallProgress(0);
    setInstallError(null);
    triggerHaptic();

    try {
      if (updateInfo.platform === 'web') {
        setInstallProgress(50);
        setTimeout(() => {
          setInstallProgress(100);
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }, 500);
        return;
      }

      if (updateInfo.platform === 'android') {
        const win = window as any;
        if (win.Capacitor?.Plugins?.AppUpdater?.installUpdate) {
          setInstallProgress(40);
          await win.Capacitor.Plugins.AppUpdater.installUpdate({ url: updateInfo.downloadUrl });
          setInstallProgress(100);
          return;
        } else {
          window.location.href = updateInfo.downloadUrl;
          setInstallProgress(100);
          return;
        }
      }

      if (window.electronAPI?.installUpdate) {
        await window.electronAPI.installUpdate(updateInfo.downloadUrl);
        return;
      }

      window.location.href = updateInfo.downloadUrl;
      setInstallProgress(100);
    } catch (err: any) {
      setIsInstalling(false);
      setInstallError(err?.message || 'Failed to install update automatically');
    }
  };

  if (!isOpen) return null;

  const handleSaveTokenAndCheck = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    setStoredGithubToken(tokenInput.trim() ? tokenInput.trim() : null);
    setShowTokenSettings(false);
    onCheckAgain(tokenInput.trim() ? tokenInput.trim() : undefined);
  };

  const getPlatformLabel = () => {
    if (!updateInfo) return 'Download Update';
    if (updateInfo.platform === 'android') return 'Download APK for Android';
    if (updateInfo.platform === 'mac') return 'Download DMG for macOS';
    if (updateInfo.platform === 'windows') return 'Download EXE for Windows';
    return 'View GitHub Release';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-apple-border dark:border-apple-borderDark overflow-hidden flex flex-col text-[#1C2B36] dark:text-[#E8EEF3] animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/80 dark:bg-[#131B24]/80">
          <div className="flex items-center space-x-2">
            <TexoLogo size={18} />
            <h3 className="text-sm font-semibold">texō Update</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
              <RefreshCw size={28} className="animate-spin text-[#395060] dark:text-[#7EAAD0]" />
              <p className="text-sm font-medium text-[#1C2B36] dark:text-[#CBD8E3]">
                Checking for updates...
              </p>
              <p className="text-xs text-[#6E7E8E] dark:text-[#8AA0B4]">Connecting to GitHub Releases</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    Unable to check for updates
                  </p>
                  <p className="text-red-600 dark:text-red-400/90 leading-relaxed">{error}</p>
                </div>
              </div>

              {/* Private repo explanation & token helper */}
              <div className="p-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                <p>
                  💡 <strong>Tip for automatic updates:</strong>
                </p>
                <p>
                  If this repository is <strong>Private</strong>, GitHub blocks unauthenticated
                  checks. Making the repository <strong>Public</strong> on GitHub allows all your Mac, Windows &amp; Android users to check for updates seamlessly with 0 configuration.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTokenSettings(!showTokenSettings)}
                  className="text-apple-yellow hover:underline flex items-center space-x-1 font-medium pt-1"
                >
                  <Key size={13} />
                  <span>{showTokenSettings ? 'Hide Private Access Token' : 'Or enter a GitHub Personal Access Token'}</span>
                </button>
              </div>

              {showTokenSettings && (
                <form onSubmit={handleSaveTokenAndCheck} className="space-y-2 pt-1">
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow font-mono"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-apple-yellow text-white rounded-lg text-xs font-medium hover:bg-apple-yellowHover"
                    >
                      Save &amp; Check Again
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : updateInfo?.hasUpdate ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <div className="p-2 rounded-full bg-apple-yellow text-white shrink-0">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {updateInfo.name} is available!
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Installed: <span className="font-mono">v{CURRENT_VERSION}</span> • Latest:{' '}
                    <span className="font-mono font-semibold text-apple-yellow">
                      v{updateInfo.latestVersion}
                    </span>
                  </p>
                </div>
              </div>

              {/* Release Notes */}
              {updateInfo.body && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    What's New:
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 max-h-40 overflow-y-auto whitespace-pre-line leading-relaxed font-sans border border-neutral-200/50 dark:border-neutral-700/50">
                    {updateInfo.body}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {isInstalling ? (
                  <div className="space-y-2.5 p-3.5 bg-amber-500/10 dark:bg-amber-500/15 rounded-xl border border-amber-500/25">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                      <span>
                        {installProgress >= 100
                          ? updateInfo.platform === 'mac'
                            ? 'Restarting texō...'
                            : updateInfo.platform === 'android'
                            ? 'Opening system installer...'
                            : updateInfo.platform === 'web'
                            ? 'Reloading...'
                            : 'Launching installer...'
                          : 'Downloading & Updating...'}
                      </span>
                      <span className="font-mono text-apple-yellow">{Math.round(installProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-apple-yellow transition-all duration-150 rounded-full"
                        style={{ width: `${installProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
                      {updateInfo.platform === 'mac'
                        ? `The app will automatically update in-place and restart with v${updateInfo.latestVersion}.`
                        : updateInfo.platform === 'android'
                        ? `Downloading update. The Android installer will prompt you to update in-place.`
                        : updateInfo.platform === 'web'
                        ? `Applying latest updates to your browser session.`
                        : `The installer will launch automatically to update texō to v${updateInfo.latestVersion}.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleInstallNow}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-apple-yellow dark:bg-[#2C4A68] hover:bg-apple-yellowHover dark:hover:bg-[#35587C] active:scale-98 text-white font-semibold text-xs shadow-md transition-all"
                    >
                      <Zap size={16} />
                      <span>
                        {updateInfo.platform === 'mac'
                          ? 'Update & Restart Now'
                          : 'Update App Now'}
                      </span>
                    </button>

                    {installError && (
                      <p className="text-[11px] text-red-500 text-center">{installError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
                <CheckCircle2 size={26} />
              </div>
              <h4 className="text-sm font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
                texō is up to date
              </h4>
              <p className="text-xs text-[#6E7E8E] dark:text-[#8AA0B4]">
                Version <span className="font-mono font-medium text-[#1C2B36] dark:text-[#CBD8E3]">v{CURRENT_VERSION}</span> is currently the newest version available.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#DFD3C0]/70 dark:border-[#223344] bg-[#EFE7D8]/80 dark:bg-[#131B24]/90 text-xs">
          <span className="text-[11px] text-[#6E7E8E] dark:text-[#8AA0B4] font-mono">v{CURRENT_VERSION}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                triggerHaptic();
                onCheckAgain();
              }}
              disabled={isChecking}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#DFD3C0] dark:border-[#2A3E52] bg-[#FAF6EF]/60 dark:bg-[#1C2733] hover:bg-[#FAF6EF] dark:hover:bg-[#25394C] text-[#1C2B36] dark:text-[#E8EEF3] transition-colors disabled:opacity-50 text-xs font-medium shadow-xs"
            >
              <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
              <span>Check Again</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#DFD3C0] dark:border-[#2A3E52] bg-[#E5DCCB] dark:bg-[#253D56] hover:bg-[#DCD0BC] dark:hover:bg-[#2E4A68] text-[#1C2B36] dark:text-white font-medium transition-colors text-xs shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

