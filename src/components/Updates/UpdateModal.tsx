import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
  Key,
} from 'lucide-react';
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
    return 'View GitHub Release';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#252525] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700/80 overflow-hidden flex flex-col text-neutral-800 dark:text-neutral-100 animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 bg-[#f9f9f9]/80 dark:bg-[#1f1f1f]/80">
          <div className="flex items-center space-x-2">
            <Sparkles size={18} className="text-apple-yellow" />
            <h3 className="text-sm font-semibold">Software Update</h3>
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
              <RefreshCw size={28} className="animate-spin text-apple-yellow" />
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Checking for updates...
              </p>
              <p className="text-xs text-neutral-400">Connecting to GitHub Releases</p>
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
                  checks. Making the repository <strong>Public</strong> on GitHub allows all your Mac &amp; Android users to check for updates seamlessly with 0 configuration.
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

              {/* Download Action */}
              <div className="pt-2">
                <a
                  href={updateInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic()}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover active:scale-98 text-white font-semibold text-xs shadow-md transition-all"
                >
                  <Download size={16} />
                  <span>{getPlatformLabel()}</span>
                  <ExternalLink size={13} className="opacity-70" />
                </a>
                {updateInfo.assetName && (
                  <p className="text-center text-[10px] text-neutral-400 mt-1.5">
                    File: <span className="font-mono">{updateInfo.assetName}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
                <CheckCircle2 size={26} />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Apple Notes is up to date
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Version <span className="font-mono font-medium">v{CURRENT_VERSION}</span> is currently the newest version available.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-[#f9f9f9]/80 dark:bg-[#1f1f1f]/80 text-xs">
          <span className="text-[11px] text-neutral-400 font-mono">v{CURRENT_VERSION}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                triggerHaptic();
                onCheckAgain();
              }}
              disabled={isChecking}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
              <span>Check Again</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

