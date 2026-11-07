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
import { TexoLogo } from '../common/TexoLogo';

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
  const defaultNotesCount = notes.filter(
    n => !n.isTrash && (n.folderId === 'default' || n.folderId === 'quick' || n.folderId === 'all' || !n.folderId)
  ).length;
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
    <aside className="w-56 bg-[#EFE7D8] dark:bg-[#101720] border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col justify-between select-none shrink-0 text-sm">
      <div className="overflow-y-auto px-2 py-3 space-y-4">
        {/* Brand Header */}
        <div className="px-2 pt-0.5 pb-2 flex items-center space-x-2.5 border-b border-[#DFD3C0]/60 dark:border-[#223344]/60">
          <TexoLogo size={22} className="shadow-xs rounded-md" />
          <span className="font-semibold text-sm tracking-tight text-[#1C2B36] dark:text-[#E8EEF3]">
            texō
          </span>
        </div>

        {/* Main Notes Section */}
        <div>
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
            Notes
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => {
                triggerHaptic();
                setSelectedFolderId('default');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                selectedFolderId === 'default'
                  ? 'bg-apple-yellow dark:bg-[#253D56] text-white font-medium shadow-xs'
                  : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#1A2530]'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <FolderIcon size={15} className={selectedFolderId === 'default' ? 'text-white' : 'text-[#395060] dark:text-[#7EAAD0]'} />
                <span className="truncate">Notes</span>
              </div>
              <span className={`text-[11px] ${selectedFolderId === 'default' ? 'text-white/80' : 'text-[#8A9BA8] dark:text-[#6E8092]'}`}>
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
                      ? 'bg-apple-yellow dark:bg-[#253D56] text-white font-medium shadow-xs'
                      : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#1A2530]'
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="flex items-center space-x-2 truncate flex-1 text-left"
                  >
                    <FolderIcon size={15} className={isSelected ? 'text-white' : 'text-[#395060] dark:text-[#7EAAD0]'} />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[#8A9BA8] dark:text-[#6E8092]'}`}>
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
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Trash2 size={14} />
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
                  className="w-full text-xs px-2 py-1 rounded bg-[#FAF6EF] dark:bg-[#1C2733] border border-apple-border dark:border-apple-borderDark outline-none focus:border-apple-yellow"
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
                ? 'bg-apple-yellow dark:bg-[#253D56] text-white font-medium shadow-xs'
                : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#1A2530]'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              <Trash size={15} className={selectedFolderId === 'trash' ? 'text-white' : 'text-[#8A9BA8] dark:text-[#6E8092]'} />
              <span className="truncate">Recently Deleted</span>
            </div>
            <span className={`text-[11px] ${selectedFolderId === 'trash' ? 'text-white/80' : 'text-[#8A9BA8] dark:text-[#6E8092]'}`}>
              {trashCount}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Action: Software Update / Version Info */}
      <div className="p-2 border-t border-apple-border dark:border-apple-borderDark">
        <button
          onClick={() => {
            triggerHaptic();
            onCheckUpdates?.();
          }}
          title="Check for software updates"
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40 transition-colors"
        >
          <span className="font-mono">v{CURRENT_VERSION}</span>
          {hasUpdate ? (
            <span className="flex items-center space-x-1 text-apple-yellow font-semibold">
              <Sparkles size={12} className="animate-pulse" />
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

