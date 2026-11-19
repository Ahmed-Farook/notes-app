import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Copy, Check } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { Note } from '../../types/note';
import { buildShareUrl } from '../../utils/shareUtils';

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
    return buildShareUrl({
      title: note.title,
      content: note.content,
      drawingStrokes: note.drawingStrokes,
    });
  }, [note]);

  if (!isOpen || !note) return null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {}
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 select-none [app-region:no-drag]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm my-auto bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-apple-border dark:border-apple-borderDark p-5 animate-in zoom-in-95 duration-150 text-[#1C2B36] dark:text-[#E8EEF3] [app-region:no-drag] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-apple-yellow/15 text-apple-yellow flex items-center justify-center shrink-0">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-[#1C2B36] dark:text-[#E8EEF3]">
                Share Note
              </h3>
              <p className="text-[11px] text-[#6E8092] dark:text-[#8AA0B4] truncate max-w-[210px]">
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

        {/* Share Link Input with Copy button */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#121922] border border-[#DFD3C0] dark:border-[#2C4054] text-[#1C2B36] dark:text-[#CBD8E3] outline-none select-all truncate font-mono"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition-all active:scale-95 shadow-xs ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-apple-yellow hover:bg-apple-yellowHover text-white'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>Copied</span>
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
    </div>
  );

  return createPortal(modalContent, document.body);
};
