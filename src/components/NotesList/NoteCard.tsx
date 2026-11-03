import React from 'react';
import { Pin, Trash2, RotateCcw } from 'lucide-react';
import { Note, ViewMode } from '../../types/note';
import { formatListDate } from '../../utils/dateUtils';
import { useNotes } from '../../store/NotesContext';

interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  viewMode: ViewMode;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, isSelected, viewMode }) => {
  const { setActiveNoteId, togglePinNote, deleteNote, restoreNote } = useNotes();

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
        onClick={() => setActiveNoteId(note.id)}
        className={`group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none aspect-[4/3] ${
          isSelected
            ? 'border-apple-yellow bg-apple-yellowLight/40 dark:bg-apple-yellow/10 shadow-sm ring-1 ring-apple-yellow'
            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
        }`}
      >
        <div className="space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate pr-1">
              {note.title || 'New Note'}
            </h4>
            {note.isPinned && (
              <Pin size={12} className="text-apple-yellow fill-apple-yellow shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed">
            {note.plainTextPreview || 'No additional text'}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-[10px] text-neutral-400">
          <span>{formatListDate(note.updatedAt)}</span>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!note.isTrash && (
              <button
                onClick={handlePin}
                title={note.isPinned ? 'Unpin note' : 'Pin note'}
                className="p-1 hover:text-apple-yellow text-neutral-400"
              >
                <Pin size={11} className={note.isPinned ? 'fill-apple-yellow text-apple-yellow' : ''} />
              </button>
            )}
            {note.isTrash ? (
              <button
                onClick={handleRestore}
                title="Restore note"
                className="p-1 hover:text-green-500 text-neutral-400"
              >
                <RotateCcw size={11} />
              </button>
            ) : (
              <button
                onClick={handleDelete}
                title="Delete note"
                className="p-1 hover:text-red-500 text-neutral-400"
              >
                <Trash2 size={11} />
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
      onClick={() => setActiveNoteId(note.id)}
      className={`group relative px-3 py-2.5 rounded-lg transition-colors cursor-pointer select-none ${
        isSelected
          ? 'bg-apple-yellow text-white shadow-sm'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70 text-neutral-900 dark:text-neutral-100'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <h4 className={`font-semibold text-xs truncate pr-2 ${isSelected ? 'text-white' : ''}`}>
          {note.title || 'New Note'}
        </h4>
        <div className="flex items-center space-x-1 shrink-0">
          {note.isPinned && (
            <Pin
              size={11}
              className={`shrink-0 ${
                isSelected ? 'fill-white text-white' : 'fill-apple-yellow text-apple-yellow'
              }`}
            />
          )}
          {/* Hover actions */}
          <div
            className={`flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
              isSelected ? 'text-white' : 'text-neutral-400'
            }`}
          >
            {!note.isTrash && (
              <button
                onClick={handlePin}
                title={note.isPinned ? 'Unpin' : 'Pin'}
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <Pin size={11} />
              </button>
            )}
            {note.isTrash ? (
              <button
                onClick={handleRestore}
                title="Restore note"
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <RotateCcw size={11} />
              </button>
            ) : (
              <button
                onClick={handleDelete}
                title="Delete note"
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-baseline space-x-1.5 text-[11px] overflow-hidden">
        <span
          className={`shrink-0 font-medium ${
            isSelected ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {formatListDate(note.updatedAt)}
        </span>
        <span
          className={`truncate ${
            isSelected ? 'text-white/70' : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          {note.plainTextPreview || 'No additional text'}
        </span>
      </div>
    </div>
  );
};

