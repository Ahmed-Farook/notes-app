import React, { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  count?: number;
  noteTitle?: string;
  message?: string;
  confirmLabel?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  count = 1,
  noteTitle,
  message,
  confirmLabel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const isBulk = count > 1;
  const heading =
    title ||
    (isBulk
      ? `Permanently Delete ${count} Notes?`
      : `Permanently Delete "${noteTitle || 'Untitled'}"?`);

  const description =
    message ||
    (isBulk
      ? `Are you sure you want to permanently delete these ${count} notes from Recently Deleted? This action cannot be undone.`
      : 'Are you sure you want to permanently delete this note from Recently Deleted? This action cannot be undone.');

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Dialog Card */}
      <div className="relative w-full max-w-sm bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-[#DFD3C0] dark:border-[#263747] p-5 space-y-4 animate-in zoom-in-95 duration-150 z-10 text-[#1C2B36] dark:text-[#E8EEF3]">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-red-500/10 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Trash2 size={20} strokeWidth={2.2} />
          </div>
          <div className="space-y-1 pr-2">
            <h3 className="text-sm font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
              {heading}
            </h3>
            <p className="text-xs text-[#6E7E8E] dark:text-[#8AA0B4] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6E7E8E] dark:text-[#8AA0B4] bg-[#EFE7D8]/80 dark:bg-[#1C2733] hover:bg-[#E5DCCB] dark:hover:bg-[#25394C] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onConfirm();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 shadow-xs transition-all"
          >
            {confirmLabel || (isBulk ? `Delete ${count} Notes` : 'Delete Permanently')}
          </button>
        </div>
      </div>
    </div>
  );
};

