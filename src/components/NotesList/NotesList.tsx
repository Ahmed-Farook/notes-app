import React, { useState } from 'react';
import {
  Search,
  X,
  FileText,
  Plus,
  Folder,
  Zap,
  Trash2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { NoteCard } from './NoteCard';
import { triggerHaptic } from '../../utils/haptics';

export const NotesList: React.FC = () => {
  const {
    notes,
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
    isFolderPickerOpen,
    setIsFolderPickerOpen,
  } = useNotes();

  // Folder note counts
  const defaultNotesCount = notes.filter(
    n => !n.isTrash && (n.folderId === 'default' || n.folderId === 'quick' || n.folderId === 'all' || !n.folderId)
  ).length;
  const trashCount = notes.filter(n => n.isTrash).length;
  const getFolderCount = (folderId: string) =>
    notes.filter(n => !n.isTrash && n.folderId === folderId).length;

  return (
    <section className="w-full md:w-72 bg-white dark:bg-[#202020] md:border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col select-none shrink-0">
      {/* Mobile folder selector pill */}
      <div className="md:hidden px-3.5 py-2 flex items-center justify-between border-b border-apple-border dark:border-apple-borderDark bg-[#fafafa]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md">
        <button
          onClick={() => {
            triggerHaptic();
            setIsFolderPickerOpen(true);
          }}
          className="flex items-center space-x-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-200/60 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 px-3 py-1.5 rounded-full transition-all active:scale-95 border border-neutral-300/40 dark:border-neutral-700/50 shadow-xs"
        >
          <Folder size={13} className="text-apple-yellow" />
          <span className="truncate max-w-[150px]">{currentFolder?.name || 'Notes'}</span>
          <ChevronDown size={12} className="text-neutral-400" />
        </button>
        <span className="text-[11px] font-medium text-neutral-400">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Apple-style Mobile Folder Bottom Sheet */}
      {isFolderPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop click dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => setIsFolderPickerOpen(false)}
          />

          <div
            className="relative w-full max-w-sm bg-[#f2f2f7] dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden flex flex-col max-h-[82vh] animate-in slide-in-from-bottom duration-250 z-10"
            role="dialog"
            aria-modal="true"
          >
            {/* Grabber indicator */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
              <div className="w-9 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200/70 dark:border-neutral-800/80">
              <div className="flex items-center space-x-2">
                <Folder size={17} className="text-apple-yellow" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Folders
                </h3>
              </div>
              <button
                onClick={() => setIsFolderPickerOpen(false)}
                className="text-xs font-semibold text-apple-yellow hover:text-apple-yellowHover py-1 px-2 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>

            {/* Folder List Group */}
            <div className="p-3 space-y-3 overflow-y-auto">
              {/* Main Notes Group */}
              <div className="bg-white dark:bg-[#2c2c2e] rounded-xl overflow-hidden shadow-xs divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {/* Notes (Default) */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    setSelectedFolderId('default');
                    setIsFolderPickerOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors text-left ${
                    selectedFolderId === 'default'
                      ? 'bg-apple-yellow/10 dark:bg-apple-yellow/15 text-apple-yellow font-semibold'
                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-md bg-amber-500/15 text-apple-yellow flex items-center justify-center shrink-0">
                      <Folder size={14} />
                    </div>
                    <span>Notes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-neutral-400 font-mono">{defaultNotesCount}</span>
                    {selectedFolderId === 'default' && (
                      <Check size={15} className="text-apple-yellow stroke-[2.5]" />
                    )}
                  </div>
                </button>
              </div>

              {/* Custom Folders Group */}
              {folders.length > 0 && (
                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Custom Folders
                  </span>
                  <div className="bg-white dark:bg-[#2c2c2e] rounded-xl overflow-hidden shadow-xs divide-y divide-neutral-100 dark:divide-neutral-800/60">
                    {folders.map(f => {
                      const count = getFolderCount(f.id);
                      const isSelected = selectedFolderId === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            triggerHaptic();
                            setSelectedFolderId(f.id);
                            setIsFolderPickerOpen(false);
                          }}
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors text-left ${
                            isSelected
                              ? 'bg-apple-yellow/10 dark:bg-apple-yellow/15 text-apple-yellow font-semibold'
                              : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate pr-2">
                            <div className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                              <Folder size={14} />
                            </div>
                            <span className="truncate">{f.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[11px] text-neutral-400 font-mono">{count}</span>
                            {isSelected && (
                              <Check size={15} className="text-apple-yellow stroke-[2.5]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trash Folder Group */}
              <div className="bg-white dark:bg-[#2c2c2e] rounded-xl overflow-hidden shadow-xs">
                <button
                  onClick={() => {
                    triggerHaptic();
                    setSelectedFolderId('trash');
                    setIsFolderPickerOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors text-left ${
                    selectedFolderId === 'trash'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold'
                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-md bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                      <Trash2 size={14} />
                    </div>
                    <span>Recently Deleted</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-neutral-400 font-mono">{trashCount}</span>
                    {selectedFolderId === 'trash' && (
                      <Check size={15} className="text-red-500 stroke-[2.5]" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
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

