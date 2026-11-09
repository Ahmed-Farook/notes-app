import React, { useState, useEffect, useRef } from 'react';
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
  Pencil,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { CURRENT_VERSION } from '../../utils/updateChecker';
import { triggerHaptic } from '../../utils/haptics';
import type { Folder as FolderType } from '../../types/note';
import { DeleteFolderModal } from '../common/DeleteFolderModal';

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
    renameFolder,
    deleteFolder,
    deleteFolders,
  } = useNotes();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Selection Mode State
  const [isFolderSelectionMode, setIsFolderSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);

  // Themed Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    folderId?: string;
    folderName?: string;
    isBulk?: boolean;
    bulkIds?: string[];
  } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    folder: FolderType;
    x: number;
    y: number;
  } | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [contextMenu]);

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
      triggerHaptic();
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  const handleRenameSubmit = (folderId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editingFolderName.trim()) {
      triggerHaptic();
      renameFolder(folderId, editingFolderName.trim());
      setEditingFolderId(null);
      setEditingFolderName('');
    }
  };

  const toggleSelectFolder = (id: string) => {
    triggerHaptic();
    setSelectedFolderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFolders = () => {
    triggerHaptic();
    if (selectedFolderIds.length === folders.length) {
      setSelectedFolderIds([]);
    } else {
      setSelectedFolderIds(folders.map(f => f.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFolderIds.length === 0) return;
    triggerHaptic();
    setDeleteModalState({
      isOpen: true,
      isBulk: true,
      bulkIds: selectedFolderIds,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteModalState) return;
    if (deleteModalState.isBulk && deleteModalState.bulkIds) {
      deleteFolders(deleteModalState.bulkIds);
      setSelectedFolderIds([]);
      setIsFolderSelectionMode(false);
    } else if (deleteModalState.folderId) {
      deleteFolder(deleteModalState.folderId);
    }
    setDeleteModalState(null);
  };

  const handleRenameSelected = () => {
    if (selectedFolderIds.length !== 1) return;
    const target = folders.find(f => f.id === selectedFolderIds[0]);
    if (target) {
      triggerHaptic();
      setEditingFolderId(target.id);
      setEditingFolderName(target.name);
      setIsFolderSelectionMode(false);
      setSelectedFolderIds([]);
    }
  };

  return (
    <aside className="w-56 bg-[#EFE7D8] dark:bg-[#101720] border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col justify-between select-none shrink-0 text-sm relative">
      <div className="overflow-y-auto px-2 py-3 space-y-4 flex-1">
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
            <div className="flex items-center space-x-1">
              {folders.length > 0 && (
                <button
                  onClick={() => {
                    triggerHaptic();
                    setIsFolderSelectionMode(prev => !prev);
                    setSelectedFolderIds([]);
                  }}
                  className="text-[11px] font-semibold text-apple-yellow hover:text-apple-yellowHover dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6] px-1 py-0.5 rounded transition-colors"
                >
                  {isFolderSelectionMode ? 'Done' : 'Select'}
                </button>
              )}
              {!isFolderSelectionMode && (
                <button
                  onClick={() => {
                    triggerHaptic();
                    setIsAddingFolder(true);
                  }}
                  title="Add New Folder"
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded"
                >
                  <FolderPlus size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Subheader when in Folder Selection Mode */}
          {isFolderSelectionMode && folders.length > 0 && (
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-[#6E7E8E] dark:text-[#8AA0B4] border-b border-[#DFD3C0]/50 dark:border-[#223344] mb-1">
              <button
                onClick={toggleSelectAllFolders}
                className="text-apple-yellow dark:text-[#7EAAD0] hover:underline font-medium"
              >
                {selectedFolderIds.length === folders.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="font-mono text-[10px]">
                {selectedFolderIds.length}/{folders.length}
              </span>
            </div>
          )}

          <div className="space-y-0.5">
            {folders.map(folder => {
              const isSelected = selectedFolderId === folder.id;
              const isEditing = editingFolderId === folder.id;
              const isChecked = selectedFolderIds.includes(folder.id);

              if (isEditing) {
                return (
                  <form
                    key={folder.id}
                    onSubmit={(e) => handleRenameSubmit(folder.id, e)}
                    className="px-2 py-1 flex items-center space-x-1 bg-[#FAF6EF] dark:bg-[#1C2733] rounded-md border border-apple-yellow dark:border-[#7EAAD0]"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingFolderId(null);
                          setEditingFolderName('');
                        }
                      }}
                      className="w-full text-xs px-1.5 py-0.5 rounded bg-transparent text-[#1C2B36] dark:text-[#E8EEF3] outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!editingFolderName.trim()}
                      title="Save folder name"
                      className={`p-1 rounded-md transition-colors ${
                        editingFolderName.trim()
                          ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                          : 'text-neutral-400/50 dark:text-neutral-500/40 cursor-not-allowed'
                      }`}
                    >
                      <Check size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFolderId(null);
                        setEditingFolderName('');
                      }}
                      title="Cancel"
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:text-[#8AA0B4] dark:hover:text-[#E8EEF3] hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={folder.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    triggerHaptic();
                    setContextMenu({
                      folder,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer select-none ${
                    isFolderSelectionMode
                      ? isChecked
                        ? 'bg-[#E5DCCB] dark:bg-[#203448] font-medium'
                        : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#1A2530]'
                      : isSelected
                      ? 'bg-apple-yellow dark:bg-[#253D56] text-white font-medium shadow-xs'
                      : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#1A2530]'
                  }`}
                  onClick={() => {
                    if (isFolderSelectionMode) {
                      toggleSelectFolder(folder.id);
                    } else {
                      setSelectedFolderId(folder.id);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isFolderSelectionMode) {
                      setEditingFolderId(folder.id);
                      setEditingFolderName(folder.name);
                    }
                  }}
                >
                  <div className="flex items-center space-x-2 truncate flex-1">
                    {isFolderSelectionMode ? (
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          isChecked
                            ? 'bg-apple-yellow dark:bg-[#345A7D] border-apple-yellow dark:border-[#7EAAD0] text-white'
                            : 'border-neutral-300 dark:border-neutral-600 bg-white/60 dark:bg-neutral-800/60'
                        }`}
                      >
                        {isChecked && <Check size={9} strokeWidth={3} />}
                      </div>
                    ) : (
                      <FolderIcon
                        size={15}
                        className={isSelected ? 'text-white' : 'text-[#395060] dark:text-[#7EAAD0]'}
                      />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {!isFolderSelectionMode && (
                      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic();
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          title="Rename Folder"
                          className={`p-1 rounded hover:scale-110 active:scale-95 transition-all ${
                            isSelected ? 'text-white/80 hover:text-white' : 'text-neutral-400 hover:text-[#213A50] dark:hover:text-[#7EAAD0]'
                          }`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic();
                            setDeleteModalState({
                              isOpen: true,
                              folderId: folder.id,
                              folderName: folder.name,
                            });
                          }}
                          title="Delete Folder"
                          className="p-1 rounded hover:text-red-500 hover:scale-110 active:scale-95 transition-all text-neutral-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                    <span
                      className={`text-[11px] min-w-[14px] text-right font-mono ${
                        isSelected && !isFolderSelectionMode
                          ? 'text-white/80'
                          : 'text-[#8A9BA8] dark:text-[#6E8092]'
                      }`}
                    >
                      {getFolderCount(folder.id)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Inline add folder form */}
            {isAddingFolder && (
              <form onSubmit={handleCreateFolder} className="px-2 py-1.5 flex items-center space-x-1.5 bg-[#FAF6EF] dark:bg-[#1C2733] rounded-lg border border-[#DFD3C0] dark:border-[#2D435A]">
                <input
                  type="text"
                  autoFocus
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsAddingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  className="w-full text-xs px-1.5 py-0.5 rounded bg-transparent outline-none text-[#1C2B36] dark:text-[#E8EEF3] placeholder-neutral-400 dark:placeholder-neutral-500"
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  title="Create folder"
                  className={`p-1 rounded-md transition-colors ${
                    newFolderName.trim()
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                      : 'text-neutral-400/50 dark:text-neutral-500/40 cursor-not-allowed'
                  }`}
                >
                  <Check size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFolder(false);
                    setNewFolderName('');
                  }}
                  title="Cancel"
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:text-[#8AA0B4] dark:hover:text-[#E8EEF3] hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Recently Deleted */}
        <div>
          <button
            onClick={() => {
              triggerHaptic();
              setSelectedFolderId('trash');
            }}
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

      {/* Selection Mode Bottom Action Bar */}
      {isFolderSelectionMode && (
        <div className="p-2 border-t border-apple-border dark:border-apple-borderDark bg-[#FAF6EF] dark:bg-[#131B24] flex items-center justify-between text-xs">
          <button
            disabled={selectedFolderIds.length !== 1}
            onClick={handleRenameSelected}
            className="flex items-center space-x-1 px-2 py-1 rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Pencil size={12} />
            <span>Rename</span>
          </button>
          <button
            disabled={selectedFolderIds.length === 0}
            onClick={handleDeleteSelected}
            className="flex items-center space-x-1 px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Trash2 size={12} />
            <span>Delete{selectedFolderIds.length > 0 ? ` (${selectedFolderIds.length})` : ''}</span>
          </button>
        </div>
      )}

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

      {/* Floating Kyoto Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.min(contextMenu.y, window.innerHeight - 130)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 160)}px`,
          }}
          className="z-50 w-36 bg-[#FAF6EF] dark:bg-[#1A2532] border border-[#DFD3C0] dark:border-[#2D435A] rounded-lg shadow-xl py-1 text-xs divide-y divide-[#DFD3C0]/40 dark:divide-[#2D435A] animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              triggerHaptic();
              setEditingFolderId(contextMenu.folder.id);
              setEditingFolderName(contextMenu.folder.name);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 text-left text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#EBE2D3] dark:hover:bg-[#233547] transition-colors"
          >
            <Pencil size={13} className="text-[#395060] dark:text-[#7EAAD0]" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic();
              setIsFolderSelectionMode(true);
              setSelectedFolderIds([contextMenu.folder.id]);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 text-left text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#EBE2D3] dark:hover:bg-[#233547] transition-colors"
          >
            <Check size={13} className="text-[#395060] dark:text-[#7EAAD0]" />
            <span>Select Folders</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic();
              const target = contextMenu.folder;
              setContextMenu(null);
              setDeleteModalState({
                isOpen: true,
                folderId: target.id,
                folderName: target.name,
              });
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Themed Delete Confirmation Dialog */}
      <DeleteFolderModal
        isOpen={Boolean(deleteModalState?.isOpen)}
        onClose={() => setDeleteModalState(null)}
        onConfirm={handleConfirmDelete}
        folderName={deleteModalState?.folderName}
        folderCount={deleteModalState?.isBulk ? deleteModalState.bulkIds?.length : 1}
      />
    </aside>
  );
};

