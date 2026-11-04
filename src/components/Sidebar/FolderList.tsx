import React, { useState } from 'react';
import {
  Folder as FolderIcon,
  FolderPlus,
  Trash2,
  FileText,
  Zap,
  Trash,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { CURRENT_VERSION } from '../../utils/updateChecker';
import { triggerHaptic } from '../../utils/haptics';

interface FolderListProps {
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
}

export const FolderList: React.FC<FolderListProps> = ({ onCheckUpdates, hasUpdate }) => {
  const {
    folders,
    notes,
    selectedFolderId,
    setSelectedFolderId,
    createFolder,
    deleteFolder,
  } = useNotes();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Calculate note counts
  const allNotesCount = notes.filter(n => !n.isTrash).length;
  const quickNotesCount = notes.filter(n => !n.isTrash && n.folderId === 'quick').length;
  const defaultNotesCount = notes.filter(n => !n.isTrash && n.folderId === 'default').length;
  const trashCount = notes.filter(n => n.isTrash).length;

  const getFolderCount = (folderId: string) => {
    return notes.filter(n => !n.isTrash && n.folderId === folderId).length;
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  return (
    <aside className="w-56 bg-[#f6f6f6] dark:bg-[#191919] border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col justify-between select-none shrink-0 text-sm">
      <div className="overflow-y-auto px-2 py-3 space-y-4">
        {/* System Folders Group */}
        <div>
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
            iCloud &amp; Local
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                selectedFolderId === 'all'
                  ? 'bg-apple-yellow text-white font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <FileText size={15} className={selectedFolderId === 'all' ? 'text-white' : 'text-apple-yellow'} />
                <span className="truncate">All Notes</span>
              </div>
              <span className={`text-[11px] ${selectedFolderId === 'all' ? 'text-white/80' : 'text-neutral-400'}`}>
                {allNotesCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedFolderId('quick')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                selectedFolderId === 'quick'
                  ? 'bg-apple-yellow text-white font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Zap size={15} className={selectedFolderId === 'quick' ? 'text-white' : 'text-apple-yellow'} />
                <span className="truncate">Quick Notes</span>
              </div>
              <span className={`text-[11px] ${selectedFolderId === 'quick' ? 'text-white/80' : 'text-neutral-400'}`}>
                {quickNotesCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedFolderId('default')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                selectedFolderId === 'default'
                  ? 'bg-apple-yellow text-white font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <FolderIcon size={15} className={selectedFolderId === 'default' ? 'text-white' : 'text-apple-yellow'} />
                <span className="truncate">Notes</span>
              </div>
              <span className={`text-[11px] ${selectedFolderId === 'default' ? 'text-white/80' : 'text-neutral-400'}`}>
                {defaultNotesCount}
              </span>
            </button>
          </div>
        </div>

        {/* Custom Folders Group */}
        <div>
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
              Folders
            </span>
            <button
              onClick={() => setIsAddingFolder(true)}
              title="Add New Folder"
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {folders.map(folder => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    isSelected
                      ? 'bg-apple-yellow text-white font-medium'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="flex items-center space-x-2 truncate flex-1 text-left"
                  >
                    <FolderIcon size={15} className={isSelected ? 'text-white' : 'text-apple-yellow'} />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-neutral-400'}`}>
                      {getFolderCount(folder.id)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete folder "${folder.name}"? Notes inside will move to Notes.`)) {
                          deleteFolder(folder.id);
                        }
                      }}
                      title="Delete Folder"
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Inline add folder form */}
            {isAddingFolder && (
              <form onSubmit={handleCreateFolder} className="px-2 py-1 flex items-center space-x-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full text-xs px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="p-1 text-apple-yellow hover:text-apple-yellowHover disabled:opacity-40"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFolder(false);
                    setNewFolderName('');
                  }}
                  className="p-1 text-neutral-400 hover:text-neutral-600"
                >
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Recently Deleted */}
        <div>
          <button
            onClick={() => setSelectedFolderId('trash')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              selectedFolderId === 'trash'
                ? 'bg-apple-yellow text-white font-medium'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              <Trash size={15} className={selectedFolderId === 'trash' ? 'text-white' : 'text-neutral-400'} />
              <span className="truncate">Recently Deleted</span>
            </div>
            <span className={`text-[11px] ${selectedFolderId === 'trash' ? 'text-white/80' : 'text-neutral-400'}`}>
              {trashCount}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Action: New Folder & Updates */}
      <div className="p-2 border-t border-apple-border dark:border-apple-borderDark space-y-1">
        <button
          onClick={() => setIsAddingFolder(true)}
          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-md text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <FolderPlus size={15} className="text-apple-yellow" />
          <span>New Folder</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic();
            onCheckUpdates?.();
          }}
          title="Check for software updates"
          className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40 transition-colors"
        >
          <span className="font-mono">v{CURRENT_VERSION}</span>
          {hasUpdate ? (
            <span className="flex items-center space-x-1 text-apple-yellow font-semibold">
              <Sparkles size={11} className="animate-pulse" />
              <span>Update Ready</span>
            </span>
          ) : (
            <span className="hover:underline">Check Updates</span>
          )}
        </button>
      </div>
    </aside>
  );
};

