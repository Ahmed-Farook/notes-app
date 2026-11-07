import React, { useRef } from 'react';
import { Pin, Trash2, RotateCcw, Check } from 'lucide-react';
import { Note, ViewMode } from '../../types/note';
import { formatListDate } from '../../utils/dateUtils';
import { useNotes } from '../../store/NotesContext';
import { triggerHaptic } from '../../utils/haptics';

interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  viewMode: ViewMode;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, isSelected, viewMode }) => {
  const {
    setActiveNoteId,
    togglePinNote,
    deleteNote,
    restoreNote,
    isSelectionMode,
    selectedNoteIds,
    toggleSelectNote,
    enterSelectionMode,
  } = useNotes();

  const isChecked = selectedNoteIds.includes(note.id);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const startLongPress = () => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      triggerHaptic();
      enterSelectionMode(note.id);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (isSelectionMode) {
      e.stopPropagation();
      toggleSelectNote(note.id);
    } else {
      triggerHaptic();
      setActiveNoteId(note.id);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinNote(note.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNote(note.id);
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    restoreNote(note.id);
  };

  if (viewMode === 'gallery') {
    return (
      <div
        onClick={handleClick}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onContextMenu={(e) => {
          if (!isSelectionMode) {
            e.preventDefault();
            enterSelectionMode(note.id);
          }
        }}
        className={`group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none aspect-[4/3] active:scale-[0.98] ${
          isSelectionMode
            ? isChecked
              ? 'border-2 border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellowLight dark:bg-[#203448] shadow-sm'
              : 'border-[#DFD3C0] dark:border-[#223344] bg-[#FAF6EF] dark:bg-[#1C2733] hover:border-[#C2B5A1] dark:hover:border-[#354E66]'
            : isSelected
            ? 'border-2 border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellowLight dark:bg-[#203448] shadow-sm'
            : 'border-[#DFD3C0] dark:border-[#223344] bg-[#FAF6EF] dark:bg-[#1C2733] hover:border-[#C2B5A1] dark:hover:border-[#354E66] shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
        }`}
      >
        <div className="space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 truncate pr-1">
              {isSelectionMode && (
                <div className="shrink-0">
                  {isChecked ? (
                    <div className="w-4 h-4 rounded-full bg-apple-yellow dark:bg-[#345A7D] flex items-center justify-center text-white shadow-xs">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-300 dark:border-neutral-600 bg-white/60 dark:bg-neutral-800/60" />
                  )}
                </div>
              )}
              <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                {note.title || 'New Note'}
              </h4>
            </div>
            {/* Gallery Pin Button: Single button for both pinning and unpinning */}
            {!note.isTrash && (
              <button
                onClick={handlePin}
                title={note.isPinned ? 'Unpin note' : 'Pin note'}
                className={`p-1 rounded hover:scale-110 active:scale-95 transition-all shrink-0 ${
                  note.isPinned
                    ? 'text-apple-yellow dark:text-[#7EAAD0]'
                    : 'hidden md:inline-flex opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-apple-yellow dark:hover:text-[#7EAAD0]'
                }`}
              >
                <Pin
                  size={15}
                  className={note.isPinned ? 'fill-apple-yellow dark:fill-[#7EAAD0] text-apple-yellow dark:text-[#7EAAD0]' : ''}
                />
              </button>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-[#8AA0B4] line-clamp-3 leading-relaxed">
            {note.plainTextPreview || 'No additional text'}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#DFD3C0]/50 dark:border-[#223344] text-[10px] text-[#8A9BA8] dark:text-[#6E8092]">
          <span>{formatListDate(note.updatedAt)}</span>
          {/* Desktop-only hover actions */}
          <div className="hidden md:flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {note.isTrash ? (
              <button
                onClick={handleRestore}
                title="Restore note"
                className="p-1 rounded hover:scale-110 active:scale-95 hover:text-green-500 text-neutral-400 transition-all"
              >
                <RotateCcw size={15} />
              </button>
            ) : (
              <button
                onClick={handleDelete}
                title="Delete note"
                className="p-1 rounded hover:scale-110 active:scale-95 hover:text-red-500 text-neutral-400 transition-all"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard List View Card (Apple Notes style)
  return (
    <div
      onClick={handleClick}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={(e) => {
        if (!isSelectionMode) {
          e.preventDefault();
          enterSelectionMode(note.id);
        }
      }}
      className={`group relative px-3 py-3 md:py-2.5 rounded-xl transition-all cursor-pointer select-none active:scale-[0.99] flex items-center border ${
        isSelectionMode
          ? isChecked
            ? 'border-2 border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellowLight dark:bg-[#203448] shadow-xs text-neutral-900 dark:text-[#E8EEF3]'
            : 'border-2 border-transparent hover:bg-[#EBE2D3] dark:hover:bg-[#202D3A] text-neutral-900 dark:text-neutral-100'
          : isSelected
          ? 'border-transparent bg-apple-yellow dark:bg-[#253D56] text-white shadow-sm'
          : 'border-transparent hover:bg-[#EBE2D3] dark:hover:bg-[#202D3A] text-[#1C2B36] dark:text-[#E8EEF3]'
      }`}
    >
      {/* Checkbox circle when in multi-select mode */}
      {isSelectionMode && (
        <div className="mr-3 shrink-0 flex items-center justify-center">
          {isChecked ? (
            <div className="w-5 h-5 rounded-full bg-apple-yellow dark:bg-[#345A7D] flex items-center justify-center text-white shadow-xs">
              <Check size={12} strokeWidth={3} />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[#DFD3C0] dark:border-[#223344] bg-[#FAF6EF]/60 dark:bg-[#1C2733]/60" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h4
            className={`font-semibold text-xs truncate pr-2 ${
              !isSelectionMode && isSelected ? 'text-white' : 'text-[#1C2B36] dark:text-[#E8EEF3]'
            }`}
          >
            {note.title || 'New Note'}
          </h4>
          <div className="flex items-center space-x-1 shrink-0">
            {/* Desktop-only hover actions (hidden on mobile to prevent misclicks) */}
            <div
              className={`hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${
                !isSelectionMode && isSelected ? 'text-white' : 'text-neutral-400'
              }`}
            >
              {note.isTrash ? (
                <button
                  onClick={handleRestore}
                  title="Restore note"
                  className="p-1 hover:scale-110 active:scale-95 hover:text-green-500 transition-all"
                >
                  <RotateCcw size={15} />
                </button>
              ) : (
                <button
                  onClick={handleDelete}
                  title="Delete note"
                  className="p-1 hover:scale-110 active:scale-95 hover:text-red-500 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {/* Pin Button: Single button for both pinning and unpinning */}
            {!note.isTrash && (
              <button
                onClick={handlePin}
                title={note.isPinned ? 'Unpin note' : 'Pin note'}
                className={`p-1 rounded hover:scale-110 active:scale-95 transition-all ${
                  note.isPinned
                    ? !isSelectionMode && isSelected
                      ? 'text-white'
                      : 'text-apple-yellow dark:text-[#7EAAD0]'
                    : `hidden md:inline-flex opacity-0 group-hover:opacity-100 ${
                        !isSelectionMode && isSelected
                          ? 'text-white/80 hover:text-white'
                          : 'text-[#8A9BA8] dark:text-[#6E8092] hover:text-apple-yellow dark:hover:text-[#7EAAD0]'
                      }`
                }`}
              >
                <Pin
                  size={15}
                  className={
                    note.isPinned
                      ? !isSelectionMode && isSelected
                        ? 'fill-white text-white'
                        : 'fill-apple-yellow text-apple-yellow dark:fill-[#7EAAD0] dark:text-[#7EAAD0]'
                      : ''
                  }
                />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-baseline space-x-1.5 text-[11px] overflow-hidden">
          <span
            className={`shrink-0 font-medium ${
              !isSelectionMode && isSelected
                ? 'text-white/80'
                : 'text-[#6E7E8E] dark:text-[#8AA0B4]'
            }`}
          >
            {formatListDate(note.updatedAt)}
          </span>
          <span
            className={`truncate ${
              !isSelectionMode && isSelected
                ? 'text-white/70'
                : 'text-[#8A9BA8] dark:text-[#6E8092]'
            }`}
          >
            {note.plainTextPreview || 'No additional text'}
          </span>
        </div>
      </div>
    </div>
  );
};

