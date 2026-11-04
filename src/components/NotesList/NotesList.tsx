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
    folders,
    selectedFolderId,
    setSelectedFolderId,
  } = useNotes();

  const [showFolderPicker, setShowFolderPicker] = React.useState(false);

  return (
    <section className="w-full md:w-72 bg-white dark:bg-[#202020] md:border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col select-none shrink-0">
      {/* Mobile folder selector pill */}
      <div className="md:hidden px-3 pt-2 pb-1 flex items-center justify-between border-b border-apple-border dark:border-apple-borderDark">
        <button
          onClick={() => setShowFolderPicker(!showFolderPicker)}
          className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full"
        >
          <span>📁 {currentFolder?.name || 'All Notes'}</span>
          <span className="text-[10px] text-neutral-400">▼</span>
        </button>
        <span className="text-xs text-neutral-400">{filteredNotes.length} notes</span>
      </div>

      {/* Mobile folder dropdown */}
      {showFolderPicker && (
        <div className="md:hidden bg-neutral-50 dark:bg-neutral-850 p-2 border-b border-apple-border dark:border-apple-borderDark grid grid-cols-2 gap-1 text-xs">
          <button
            onClick={() => { setSelectedFolderId('all'); setShowFolderPicker(false); }}
            className={`p-2 rounded text-left ${selectedFolderId === 'all' ? 'bg-apple-yellow text-white font-bold' : 'bg-white dark:bg-neutral-800'}`}
          >
            All Notes
          </button>
          <button
            onClick={() => { setSelectedFolderId('quick'); setShowFolderPicker(false); }}
            className={`p-2 rounded text-left ${selectedFolderId === 'quick' ? 'bg-apple-yellow text-white font-bold' : 'bg-white dark:bg-neutral-800'}`}
          >
            Quick Notes
          </button>
          <button
            onClick={() => { setSelectedFolderId('default'); setShowFolderPicker(false); }}
            className={`p-2 rounded text-left ${selectedFolderId === 'default' ? 'bg-apple-yellow text-white font-bold' : 'bg-white dark:bg-neutral-800'}`}
          >
            Notes
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { setSelectedFolderId(f.id); setShowFolderPicker(false); }}
              className={`p-2 rounded text-left truncate ${selectedFolderId === f.id ? 'bg-apple-yellow text-white font-bold' : 'bg-white dark:bg-neutral-800'}`}
            >
              {f.name}
            </button>
          ))}
          <button
            onClick={() => { setSelectedFolderId('trash'); setShowFolderPicker(false); }}
            className={`p-2 rounded text-left text-red-500 ${selectedFolderId === 'trash' ? 'bg-red-500 text-white font-bold' : 'bg-white dark:bg-neutral-800'}`}
          >
            Recently Deleted
          </button>
        </div>
      )}
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

