import React, { useState, useRef } from 'react';
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

  // Mobile Touch Swipe Gesture State
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeOffsetRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSelectionMode) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    hasTriggeredHapticRef.current = false;
    startLongPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSelectionMode || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // If scrolling vertically, let the parent scroll view handle it without triggering horizontal swipe
    if (!isSwipingRef.current && absY > 8 && absY * 1.3 > absX) {
      cancelLongPress();
      return;
    }

    // Require deliberate horizontal movement (at least 18px and dominant over vertical) to start swipe
    if (!isSwipingRef.current && absX > 18 && absX > absY * 1.5) {
      isSwipingRef.current = true;
      cancelLongPress();
    }

    if (isSwipingRef.current) {
      cancelLongPress();
      // Apply rubber-band resistance curve after 75px for a natural, controlled feel
      const sign = dx > 0 ? 1 : -1;
      const base = Math.min(absX, 75);
      const extra = Math.max(0, absX - 75) * 0.45;
      const clamped = sign * Math.min(125, base + extra);

      // Trigger a subtle tactile haptic pulse exactly when crossing the execution threshold (88px)
      const THRESHOLD = 88;
      if (Math.abs(clamped) >= THRESHOLD && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        triggerHaptic();
      } else if (Math.abs(clamped) < THRESHOLD) {
        hasTriggeredHapticRef.current = false;
      }

      swipeOffsetRef.current = clamped;
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    const currentOffset = swipeOffsetRef.current;
    const wasSwiping = isSwipingRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    swipeOffsetRef.current = 0;
    hasTriggeredHapticRef.current = false;

    const SWIPE_ACTION_THRESHOLD = 88;

    if (wasSwiping) {
      if (currentOffset < -SWIPE_ACTION_THRESHOLD) {
        // Swiped Left past threshold: Delete note
        triggerHaptic();
        deleteNote(note.id);
      } else if (currentOffset > SWIPE_ACTION_THRESHOLD) {
        // Swiped Right past threshold: Pin or restore
        triggerHaptic();
        if (note.isTrash) {
          restoreNote(note.id);
        } else {
          togglePinNote(note.id);
        }
      }
    }

    setSwipeOffset(0);
    setTimeout(() => {
      isSwipingRef.current = false;
    }, 120);
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

  // Standard List View Card (Apple Notes style with mobile swipe actions)
  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe reveal background actions */}
      {swipeOffset !== 0 && (
        <div className="absolute inset-0 flex items-center rounded-xl overflow-hidden pointer-events-none select-none bg-[#EBE2D3]/60 dark:bg-[#111822]">
          {/* Swiping Right: Pin / Unpin (or Restore if in trash) */}
          {swipeOffset > 0 && (
            <div className="h-full w-full flex items-center px-3.5 justify-start">
              <div
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-all duration-150 ${
                  Math.abs(swipeOffset) >= 88
                    ? note.isTrash
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40 scale-105 font-medium'
                      : 'bg-[#213A50] dark:bg-[#203D5C] text-white shadow-md ring-2 ring-[#3A5D80]/60 scale-105 font-medium'
                    : note.isTrash
                    ? 'bg-emerald-600/85 text-white/90 scale-95'
                    : 'bg-[#213A50]/85 dark:bg-[#203D5C]/85 text-white/90 scale-95'
                }`}
              >
                {note.isTrash ? (
                  <>
                    <RotateCcw size={14} className="stroke-[2.2]" />
                    <span className="text-[11px] tracking-wide font-medium">
                      {Math.abs(swipeOffset) >= 88 ? 'Release to Restore' : 'Restore'}
                    </span>
                  </>
                ) : (
                  <>
                    <Pin
                      size={14}
                      className={
                        note.isPinned
                          ? 'text-amber-400 dark:text-amber-300 stroke-[2.2]'
                          : 'fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300 stroke-[2.2]'
                      }
                    />
                    <span className="text-[11px] tracking-wide font-medium">
                      {Math.abs(swipeOffset) >= 88
                        ? note.isPinned
                          ? 'Release to Unpin'
                          : 'Release to Pin'
                        : note.isPinned
                        ? 'Unpin'
                        : 'Pin'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Swiping Left: Delete */}
          {swipeOffset < 0 && (
            <div className="h-full w-full flex items-center px-3.5 justify-end">
              <div
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-all duration-150 ${
                  Math.abs(swipeOffset) >= 88
                    ? 'bg-rose-600 dark:bg-red-600 text-white shadow-md ring-2 ring-red-400/40 scale-105 font-medium'
                    : 'bg-rose-600/85 dark:bg-red-600/85 text-white/90 scale-95'
                }`}
              >
                <span className="text-[11px] tracking-wide font-medium">
                  {Math.abs(swipeOffset) >= 88 ? 'Release to Delete' : 'Delete'}
                </span>
                <Trash2 size={14} className="stroke-[2.2]" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Foreground Note Card */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipingRef.current ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        onContextMenu={(e) => {
          if (!isSelectionMode) {
            e.preventDefault();
            enterSelectionMode(note.id);
          }
        }}
        className={`group relative px-3 py-3 md:py-2.5 rounded-xl transition-colors cursor-pointer select-none active:scale-[0.99] flex items-center border ${
          isSelectionMode
            ? isChecked
              ? 'border-2 border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellowLight dark:bg-[#203448] shadow-xs text-neutral-900 dark:text-[#E8EEF3]'
              : 'border-2 border-transparent bg-[#F6EFE4] dark:bg-[#16202A] hover:bg-[#EBE2D3] dark:hover:bg-[#202D3A] text-neutral-900 dark:text-neutral-100'
            : isSelected
            ? 'border-transparent bg-apple-yellow dark:bg-[#253D56] text-white shadow-sm'
            : 'border-transparent bg-[#F6EFE4] dark:bg-[#16202A] hover:bg-[#EBE2D3] dark:hover:bg-[#202D3A] text-[#1C2B36] dark:text-[#E8EEF3]'
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
  </div>
);
};

