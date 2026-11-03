import React from 'react';
import { Search, X, FileText, Plus } from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { NoteCard } from './NoteCard';

export const NotesList: React.FC = () => {
  const {
    filteredNotes,
    pinnedNotes,
    unpinnedNotes,
    activeNoteId,
    searchQuery,
    setSearchQuery,
    viewMode,
    currentFolder,
    createNote,
  } = useNotes();

  return (
    <section className="w-72 bg-white dark:bg-[#202020] border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col select-none shrink-0">
      {/* Search Bar */}
      <div className="p-2.5 border-b border-apple-border dark:border-apple-borderDark">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search all notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-apple-yellow transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Notes List / Gallery container */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-400 dark:text-neutral-500">
            <FileText size={32} className="mb-2 stroke-1 opacity-60" />
            <p className="text-xs font-medium">
              {searchQuery ? `No notes matching "${searchQuery}"` : 'No Notes Yet'}
            </p>
            {!searchQuery && currentFolder?.id !== 'trash' && (
              <button
                onClick={() => createNote()}
                className="mt-3 flex items-center space-x-1 text-xs text-apple-yellow hover:text-apple-yellowHover font-medium"
              >
                <Plus size={13} />
                <span>Create a note</span>
              </button>
            )}
          </div>
        ) : viewMode === 'gallery' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                isSelected={note.id === activeNoteId}
                viewMode="gallery"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  Pinned
                </div>
                <div className="space-y-0.5">
                  {pinnedNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isSelected={note.id === activeNoteId}
                      viewMode="list"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unpinned Notes Section */}
            {unpinnedNotes.length > 0 && (
              <div className="space-y-1">
                {pinnedNotes.length > 0 && (
                  <div className="px-2 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    Notes
                  </div>
                )}
                <div className="space-y-0.5">
                  {unpinnedNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isSelected={note.id === activeNoteId}
                      viewMode="list"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
