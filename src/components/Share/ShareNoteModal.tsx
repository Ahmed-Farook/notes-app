import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Copy, Check, ExternalLink, Globe, Lock, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { Note } from '../../types/note';

interface ShareNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({
  isOpen,
  onClose,
  note,
}) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (!note) return '';
    try {
      const payload = {
        title: note.title || 'Untitled Note',
        content: note.content || '',
        strokes: note.drawingStrokes || undefined,
      };
      const jsonStr = JSON.stringify(payload);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      return `https://ahmed-farook.github.io/notes-app/share.html#data=${encoded}`;
    } catch (_) {
      return '';
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  const handleOpenBrowser = () => {
    if (!shareUrl) return;
    triggerHaptic();
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 select-none [app-region:no-drag]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md my-auto bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-apple-border dark:border-apple-borderDark p-5 animate-in zoom-in-95 duration-150 text-[#1C2B36] dark:text-[#E8EEF3] [app-region:no-drag]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-[#1C2B36] dark:text-[#E8EEF3]">
                Share Note Link
              </h3>
              <p className="text-[11px] text-[#6E8092] dark:text-[#8AA0B4] truncate max-w-[240px]">
                {note.title || 'Untitled Note'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#6E8092] dark:text-[#8AA0B4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Note Details & Badges */}
        <div className="space-y-3 mb-4">
          <div className="p-3 rounded-xl bg-[#EFE8DA] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#6E8092] dark:text-[#8AA0B4] mb-1">
              <span className="flex items-center space-x-1">
                <Globe size={12} className="text-emerald-500" />
                <span>Public Read-Only Web Link</span>
              </span>
              <span>Rich Text & Drawing</span>
            </div>
            <p className="text-[#1C2B36] dark:text-[#E8EEF3] font-medium line-clamp-2">
              {note.plainTextPreview || 'No content preview'}
            </p>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] text-[#6E8092] dark:text-[#8AA0B4]">
            <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Anyone with this secret link can view the note in any browser without an account.</span>
          </div>

          {/* Share Link Input with Copy button */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#121922] border border-[#DFD3C0] dark:border-[#2C4054] text-[#1C2B36] dark:text-[#CBD8E3] font-mono outline-none select-all truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover text-white font-semibold text-xs flex items-center space-x-1.5 transition-all active:scale-95 shrink-0 shadow-xs"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#DFD3C0]/60 dark:border-[#263747]">
          <button
            type="button"
            onClick={handleOpenBrowser}
            className="flex items-center space-x-1.5 text-xs text-[#213A50] dark:text-[#7EAAD0] hover:underline font-medium"
          >
            <ExternalLink size={13} />
            <span>Open preview in browser</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold text-[#6E8092] dark:text-[#8AA0B4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

