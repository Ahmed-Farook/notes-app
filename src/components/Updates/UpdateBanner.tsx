import React from 'react';
import { Sparkles, Download, X, ExternalLink, Zap } from 'lucide-react';
import { UpdateInfo } from '../../utils/updateChecker';
import { triggerHaptic } from '../../utils/haptics';

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onOpenDetails: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onOpenDetails,
  onDismiss,
}) => {
  const getActionText = () => {
    if (updateInfo.platform === 'android') return 'Download APK';
    if (updateInfo.platform === 'mac') return 'Download DMG';
    return 'Update';
  };

  return (
    <aside
      aria-label="Software update notification"
      className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/30 px-3.5 py-1.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 select-none animate-in slide-in-from-top-2 duration-200 shrink-0 [app-region:no-drag]"
    >
      <div className="flex items-center space-x-2 truncate">
        <Sparkles size={14} className="text-apple-yellow shrink-0 animate-pulse" />
        <span className="truncate">
          <strong>Apple Notes v{updateInfo.latestVersion}</strong> is available (you have v
          {updateInfo.currentVersion}).
        </span>
      </div>

      <div className="flex items-center space-x-2 shrink-0 ml-2">
        <button
          onClick={() => {
            triggerHaptic();
            onOpenDetails();
          }}
          className="text-[11px] underline hover:text-amber-700 dark:hover:text-amber-100 hidden sm:inline"
        >
          View Changes
        </button>

        {updateInfo.platform === 'mac' && Boolean(window.electronAPI?.installUpdate) ? (
          <button
            onClick={() => {
              triggerHaptic();
              onOpenDetails();
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-apple-yellow hover:bg-apple-yellowHover text-white font-medium text-[11px] shadow-sm active:scale-95 transition-all"
          >
            <Zap size={12} />
            <span>Update Now</span>
          </button>
        ) : (
          <a
            href={updateInfo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic()}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-apple-yellow hover:bg-apple-yellowHover text-white font-medium text-[11px] shadow-sm active:scale-95 transition-all"
          >
            <Download size={12} />
            <span>{getActionText()}</span>
            <ExternalLink size={10} className="opacity-80" />
          </a>
        )}

        <button
          onClick={() => {
            triggerHaptic();
            onDismiss();
          }}
          className="p-1 text-amber-700/60 dark:text-amber-300/60 hover:text-amber-900 dark:hover:text-amber-100 rounded transition-colors"
          title="Dismiss update banner"
        >
          <X size={13} />
        </button>
      </div>
    </aside>
  );
};

