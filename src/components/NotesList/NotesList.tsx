import React, { useState, useRef } from 'react';
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
  Pin,
  RotateCcw,
  FolderInput,
  FolderPlus,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { NoteCard } from './NoteCard';
import { triggerHaptic } from '../../utils/haptics';
import { getDateBucket, DateBucket } from '../../utils/dateUtils';
import type { UpdateInfo } from '../../utils/updateChecker';
import type { Folder as FolderType } from '../../types/note';
import { DeleteFolderModal } from '../common/DeleteFolderModal';

interface NotesListProps {
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
  updateInfo?: UpdateInfo | null;
}

export const NotesList: React.FC<NotesListProps> = ({
  onCheckUpdates,
  hasUpdate,
  updateInfo,
}) => {
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
    createFolder,
    renameFolder,
    deleteFolder,
    deleteFolders,
    selectedFolderId,
    setSelectedFolderId,
    isFolderPickerOpen,
    setIsFolderPickerOpen,
    isSelectionMode,
    selectedNoteIds,
    enterSelectionMode,
    exitSelectionMode,
    selectAllNotes,
    deselectAllNotes,
    deleteSelectedNotes,
    togglePinSelectedNotes,
    moveSelectedNotesToFolder,
    restoreSelectedNotes,
  } = useNotes();

  const [showMovePicker, setShowMovePicker] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Mobile Folder Selection Mode & Long Press Action Sheet
  const [isFolderSelectionMode, setIsFolderSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [actionSheetFolder, setActionSheetFolder] = useState<FolderType | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    folderId?: string;
    folderName?: string;
    isBulk?: boolean;
    bulkIds?: string[];
  } | null>(null);
  const folderTouchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFolderLongPressRef = useRef(false);
  const folderTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Bottom sheet drag-to-dismiss gesture state
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const sheetTouchStartY = useRef<number | null>(null);

  const handleFolderTouchStart = (folder: FolderType, e: React.TouchEvent) => {
    if (isFolderSelectionMode) return;
    folderTouchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isFolderLongPressRef.current = false;
    folderTouchTimerRef.current = setTimeout(() => {
      isFolderLongPressRef.current = true;
      triggerHaptic();
      setActionSheetFolder(folder);
    }, 450);
  };

  const handleFolderTouchMove = (e: React.TouchEvent) => {
    if (!folderTouchStartPosRef.current) return;
    const dx = e.touches[0].clientX - folderTouchStartPosRef.current.x;
    const dy = e.touches[0].clientY - folderTouchStartPosRef.current.y;
    if (Math.hypot(dx, dy) > 10) {
      if (folderTouchTimerRef.current) {
        clearTimeout(folderTouchTimerRef.current);
        folderTouchTimerRef.current = null;
      }
    }
  };

  const handleFolderTouchEnd = () => {
    if (folderTouchTimerRef.current) {
      clearTimeout(folderTouchTimerRef.current);
      folderTouchTimerRef.current = null;
    }
    folderTouchStartPosRef.current = null;
  };

  const toggleSelectFolder = (folderId: string) => {
    triggerHaptic();
    setSelectedFolderIds(prev =>
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
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

  const handleDeleteSelectedFolders = () => {
    if (selectedFolderIds.length === 0) return;
    triggerHaptic();
    setDeleteModalState({
      isOpen: true,
      isBulk: true,
      bulkIds: selectedFolderIds,
    });
  };

  const handleConfirmDeleteFolder = () => {
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

  const handleRenameSelectedFolder = () => {
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

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      triggerHaptic();
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  const handleRenameFolder = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editingFolderName.trim()) {
      triggerHaptic();
      renameFolder(id, editingFolderName.trim());
      setEditingFolderId(null);
      setEditingFolderName('');
    }
  };

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (sheetTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - sheetTouchStartY.current;
    if (deltaY > 0) {
      setSheetDragOffset(deltaY);
    }
  };

  const handleSheetTouchEnd = () => {
    if (sheetDragOffset > 75) {
      triggerHaptic();
      setIsFolderPickerOpen(false);
    }
    setSheetDragOffset(0);
    sheetTouchStartY.current = null;
  };

  // Group unpinned notes by date buckets: Today, Yesterday, Previous 7 Days, Older
  const dateBuckets: DateBucket[] = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];
  const notesByBucket = dateBuckets
    .map(bucket => ({
      bucket,
      notes: unpinnedNotes.filter(n => getDateBucket(n.updatedAt) === bucket),
    }))
    .filter(group => group.notes.length > 0);

  // Folder note counts
  const defaultNotesCount = notes.filter(
    n => !n.isTrash && (n.folderId === 'default' || n.folderId === 'quick' || n.folderId === 'all' || !n.folderId)
  ).length;
  const trashCount = notes.filter(n => n.isTrash).length;
  const getFolderCount = (folderId: string) =>
    notes.filter(n => !n.isTrash && n.folderId === folderId).length;

  const allSelected = filteredNotes.length > 0 && selectedNoteIds.length === filteredNotes.length;

  return (
    <section className="w-full md:w-72 bg-[#F6EFE4] dark:bg-[#16202A] md:border-r border-apple-border dark:border-apple-borderDark h-full flex flex-col select-none shrink-0 relative">
      {/* Top Header: Selection Header vs Normal Folder Selector Pill */}
      {isSelectionMode ? (
        <div className="h-10 px-3.5 flex items-center justify-between border-b border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/95 dark:bg-[#131B24]/95 backdrop-blur-md shrink-0">
          <button
            onClick={() => {
              triggerHaptic();
              allSelected ? deselectAllNotes() : selectAllNotes();
            }}
            className="text-xs font-semibold text-apple-yellow hover:text-apple-yellowHover dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6]"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
            {selectedNoteIds.length} Selected
          </span>
          <button
            onClick={() => {
              triggerHaptic();
              exitSelectionMode();
            }}
            className="text-xs font-semibold text-apple-yellow hover:text-apple-yellowHover dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6]"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="h-10 px-3.5 flex items-center justify-between border-b border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/90 dark:bg-[#131B24]/90 backdrop-blur-md shrink-0">
          <span className="text-xs font-medium text-[#6E7E8E] dark:text-[#8AA0B4]">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          </span>
          {filteredNotes.length > 0 && (
            <button
              onClick={() => {
                triggerHaptic();
                enterSelectionMode();
              }}
              className="text-xs font-semibold text-apple-yellow hover:text-apple-yellowHover dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6] px-2 py-0.5 rounded transition-colors active:scale-95"
            >
              Select
            </button>
          )}
        </div>
      )}

      {/* Apple-style Mobile Folder Bottom Sheet */}
      {isFolderPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop click dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setIsFolderPickerOpen(false);
              setIsFolderSelectionMode(false);
              setSelectedFolderIds([]);
            }}
          />

          <div
            style={{
              transform: `translateY(${sheetDragOffset}px)`,
              transition: sheetDragOffset === 0 ? 'transform 0.2s ease-out' : 'none',
            }}
            className="relative w-full max-w-sm bg-[#EFE7D8] dark:bg-[#131B24] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#DFD3C0] dark:border-[#223344] overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-250 z-10"
            role="dialog"
            aria-modal="true"
          >
            {/* Grabber indicator & drag touch zone */}
            <div
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="pt-2.5 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <div className="w-10 h-1.5 bg-[#C9BEAA] dark:bg-[#2F4357] rounded-full" />
            </div>

            {/* Sheet Header */}
            <div
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="flex items-center justify-between px-5 py-3 border-b border-[#DFD3C0]/70 dark:border-[#223344] bg-[#EFE7D8] dark:bg-[#131B24] select-none"
            >
              {isFolderSelectionMode ? (
                <>
                  <button
                    onClick={toggleSelectAllFolders}
                    className="text-xs font-semibold text-apple-yellow dark:text-[#7EAAD0] hover:underline"
                  >
                    {selectedFolderIds.length === folders.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
                    {selectedFolderIds.length} Selected
                  </span>
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setIsFolderSelectionMode(false);
                      setSelectedFolderIds([]);
                    }}
                    className="text-xs font-semibold text-apple-yellow dark:text-[#7EAAD0] hover:underline"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Folder size={17} className="text-[#213A50] dark:text-[#7EAAD0]" />
                    <h3 className="text-sm font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
                      Folders
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {folders.length > 0 && (
                      <button
                        onClick={() => {
                          triggerHaptic();
                          setIsFolderSelectionMode(true);
                          setSelectedFolderIds([]);
                        }}
                        className="text-xs font-semibold text-[#213A50] hover:text-[#172A3C] dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6] py-1 px-2.5 rounded-lg transition-colors active:scale-95"
                      >
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsFolderPickerOpen(false);
                        setIsFolderSelectionMode(false);
                        setSelectedFolderIds([]);
                      }}
                      className="text-xs font-semibold text-[#213A50] hover:text-[#172A3C] dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6] py-1 px-2.5 rounded-lg transition-colors active:scale-95"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Folder List Group */}
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {/* Main Notes Group */}
              <div className={`bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0]/60 dark:border-[#223344] rounded-xl overflow-hidden shadow-xs divide-y divide-[#DFD3C0]/40 dark:divide-[#223344] ${
                isFolderSelectionMode ? 'opacity-40 pointer-events-none' : ''
              }`}>
                {/* Notes (Default) */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    setSelectedFolderId('default');
                    setIsFolderPickerOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors text-left ${
                    selectedFolderId === 'default'
                      ? 'bg-[#213A50] dark:bg-[#254260] text-white font-medium shadow-xs'
                      : 'text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        selectedFolderId === 'default'
                          ? 'bg-white/20 text-white'
                          : 'bg-[#E8F1F7] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0]'
                      }`}
                    >
                      <Folder size={14} />
                    </div>
                    <span className="font-medium">Notes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[11px] font-mono ${
                        selectedFolderId === 'default' ? 'text-white/90' : 'text-[#8A9BA8] dark:text-[#8AA0B4]'
                      }`}
                    >
                      {defaultNotesCount}
                    </span>
                    {selectedFolderId === 'default' && (
                      <Check size={15} className="text-white stroke-[2.5]" />
                    )}
                  </div>
                </button>
              </div>

              {/* Custom Folders Group */}
              <div className="space-y-1">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#6E7E8E] dark:text-[#8AA0B4]">
                  Custom Folders
                </span>
                <div className="bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0]/60 dark:border-[#223344] rounded-xl overflow-hidden shadow-xs divide-y divide-[#DFD3C0]/40 dark:divide-[#223344]">
                  {/* Inline Add Folder Row */}
                  {!isFolderSelectionMode && (
                    isAddingFolder ? (
                      <form onSubmit={handleCreateFolder} className="px-3.5 py-2 flex items-center space-x-2 bg-[#F2EAE0] dark:bg-[#16202B]">
                        <FolderPlus size={16} className="text-[#213A50] dark:text-[#7EAAD0] shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Folder name..."
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="w-full text-xs px-2.5 py-1 rounded bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#2B3F54] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:border-[#213A50] dark:focus:border-[#7EAAD0]"
                        />
                        <button
                          type="submit"
                          disabled={!newFolderName.trim()}
                          title="Create folder"
                          className={`p-1.5 rounded-md transition-colors ${
                            newFolderName.trim()
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                              : 'text-neutral-400/50 dark:text-neutral-500/40 cursor-not-allowed'
                          }`}
                        >
                          <Check size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingFolder(false);
                            setNewFolderName('');
                          }}
                          title="Cancel"
                          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:text-[#8AA0B4] dark:hover:text-[#E8EEF3] hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                        >
                          <X size={16} strokeWidth={2} />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setIsAddingFolder(true);
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center space-x-2.5 text-xs font-medium text-[#213A50] dark:text-[#7EAAD0] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C] transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-md bg-[#213A50]/10 dark:bg-[#7EAAD0]/15 flex items-center justify-center shrink-0">
                          <FolderPlus size={14} className="text-[#213A50] dark:text-[#7EAAD0]" />
                        </div>
                        <span className="font-semibold">New Folder...</span>
                      </button>
                    )
                  )}

                  {/* Existing Custom Folders */}
                  {folders.map(f => {
                    const count = getFolderCount(f.id);
                    const isSelected = selectedFolderId === f.id;
                    const isEditing = editingFolderId === f.id;
                    const isChecked = selectedFolderIds.includes(f.id);

                    if (isEditing) {
                      return (
                        <form
                          key={f.id}
                          onSubmit={(e) => handleRenameFolder(f.id, e)}
                          className="px-3.5 py-2 flex items-center space-x-2 bg-[#F2EAE0] dark:bg-[#16202B]"
                        >
                          <Folder size={15} className="text-[#213A50] dark:text-[#7EAAD0] shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            className="w-full text-xs px-2.5 py-1 rounded bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#2B3F54] text-[#1C2B36] dark:text-[#E8EEF3] outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!editingFolderName.trim()}
                            title="Save folder name"
                            className={`p-1.5 rounded-md transition-colors ${
                              editingFolderName.trim()
                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                                : 'text-neutral-400/50 dark:text-neutral-500/40 cursor-not-allowed'
                            }`}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFolderId(null);
                              setEditingFolderName('');
                            }}
                            title="Cancel"
                            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:text-[#8AA0B4] dark:hover:text-[#E8EEF3] hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                          >
                            <X size={16} strokeWidth={2} />
                          </button>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={f.id}
                        onTouchStart={(e) => handleFolderTouchStart(f, e)}
                        onTouchMove={handleFolderTouchMove}
                        onTouchEnd={handleFolderTouchEnd}
                        onTouchCancel={handleFolderTouchEnd}
                        onClick={() => {
                          if (isFolderLongPressRef.current) {
                            isFolderLongPressRef.current = false;
                            return;
                          }
                          if (isFolderSelectionMode) {
                            toggleSelectFolder(f.id);
                          } else {
                            triggerHaptic();
                            setSelectedFolderId(f.id);
                            setIsFolderPickerOpen(false);
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer select-none ${
                          isFolderSelectionMode
                            ? isChecked
                              ? 'bg-[#E5DCCB] dark:bg-[#203448] font-medium'
                              : 'text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C]'
                            : isSelected
                            ? 'bg-[#213A50] dark:bg-[#254260] text-white font-medium shadow-xs'
                            : 'text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate flex-1">
                          {isFolderSelectionMode ? (
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                                isChecked
                                  ? 'bg-apple-yellow dark:bg-[#345A7D] border-apple-yellow dark:border-[#7EAAD0] text-white shadow-xs'
                                  : 'border-neutral-300 dark:border-neutral-600 bg-white/60 dark:bg-neutral-800/60'
                              }`}
                            >
                              {isChecked && <Check size={10} strokeWidth={3} />}
                            </div>
                          ) : (
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#E8F1F7] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0]'
                              }`}
                            >
                              <Folder size={14} />
                            </div>
                          )}
                          <span className="truncate">{f.name}</span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span
                            className={`text-[11px] font-mono ${
                              !isFolderSelectionMode && isSelected
                                ? 'text-white/90'
                                : 'text-[#8A9BA8] dark:text-[#8AA0B4]'
                            }`}
                          >
                            {count}
                          </span>
                          {!isFolderSelectionMode && isSelected && (
                            <Check size={15} className="text-white stroke-[2.5]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trash Folder Group */}
              <div className={`bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0]/60 dark:border-[#223344] rounded-xl overflow-hidden shadow-xs ${
                isFolderSelectionMode ? 'opacity-40 pointer-events-none' : ''
              }`}>
                <button
                  onClick={() => {
                    triggerHaptic();
                    setSelectedFolderId('trash');
                    setIsFolderPickerOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors text-left ${
                    selectedFolderId === 'trash'
                      ? 'bg-red-500/15 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium'
                      : 'text-[#1C2B36] dark:text-[#CBD8E3] hover:bg-[#E5DCCB] dark:hover:bg-[#223344]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-md bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                      <Trash2 size={14} />
                    </div>
                    <span>Recently Deleted</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-[#8A9BA8] dark:text-[#6E8092] font-mono">{trashCount}</span>
                    {selectedFolderId === 'trash' && (
                      <Check size={15} className="text-red-500 stroke-[2.5]" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Folder Selection Mode Sticky Action Bar */}
            {isFolderSelectionMode && (
              <div className="p-3 border-t border-[#DFD3C0]/70 dark:border-[#223344] bg-[#EFE7D8] dark:bg-[#131B24] flex items-center justify-between shrink-0">
                <button
                  disabled={selectedFolderIds.length !== 1}
                  onClick={handleRenameSelectedFolder}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#213A50] dark:text-[#7EAAD0] hover:bg-[#E5DCCB] dark:hover:bg-[#1F2C3A] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <Pencil size={14} />
                  <span>Rename</span>
                </button>
                <button
                  disabled={selectedFolderIds.length === 0}
                  onClick={handleDeleteSelectedFolders}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete{selectedFolderIds.length > 0 ? ` (${selectedFolderIds.length})` : ''}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Long-Press Folder Action Sheet Modal - Rendered at root z-[120] so it is never trapped underneath */}
      {actionSheetFolder && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div
            className="absolute inset-0"
            onClick={() => setActionSheetFolder(null)}
          />
          <div className="relative w-full max-w-sm bg-[#EFE7D8] dark:bg-[#131B24] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#DFD3C0] dark:border-[#223344] overflow-hidden p-3 space-y-2.5 animate-in slide-in-from-bottom duration-200 z-10">
            {/* Header Info */}
            <div className="px-3 py-2 flex items-center space-x-3 border-b border-[#DFD3C0]/60 dark:border-[#223344]">
              <div className="w-8 h-8 rounded-lg bg-[#213A50]/10 dark:bg-[#7EAAD0]/15 flex items-center justify-center text-[#213A50] dark:text-[#7EAAD0] shrink-0">
                <Folder size={16} />
              </div>
              <div className="truncate">
                <h4 className="text-xs font-semibold text-[#1C2B36] dark:text-[#E8EEF3] truncate">
                  {actionSheetFolder.name}
                </h4>
                <p className="text-[10px] text-[#8A9BA8] dark:text-[#8AA0B4]">
                  {getFolderCount(actionSheetFolder.id)} {getFolderCount(actionSheetFolder.id) === 1 ? 'note' : 'notes'}
                </p>
              </div>
            </div>

            {/* Actions Group (No "Select Folders" button as requested) */}
            <div className="bg-[#FAF6EF] dark:bg-[#1C2733] rounded-xl overflow-hidden divide-y divide-[#DFD3C0]/40 dark:divide-[#223344] border border-[#DFD3C0]/50 dark:border-[#223344]">
              <button
                onClick={() => {
                  triggerHaptic();
                  setEditingFolderId(actionSheetFolder.id);
                  setEditingFolderName(actionSheetFolder.name);
                  setActionSheetFolder(null);
                }}
                className="w-full px-4 py-3 flex items-center space-x-3 text-xs font-medium text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C] transition-colors text-left"
              >
                <Pencil size={15} className="text-[#395060] dark:text-[#7EAAD0]" />
                <span>Rename Folder</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic();
                  const targetFolder = actionSheetFolder;
                  setActionSheetFolder(null);
                  setDeleteModalState({
                    isOpen: true,
                    folderId: targetFolder.id,
                    folderName: targetFolder.name,
                  });
                }}
                className="w-full px-4 py-3 flex items-center space-x-3 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
              >
                <Trash2 size={15} />
                <span>Delete Folder</span>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setActionSheetFolder(null)}
              className="w-full py-2.5 rounded-xl bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0]/60 dark:border-[#223344] text-xs font-semibold text-[#6E7E8E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB] dark:hover:bg-[#202E3C] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Themed Delete Confirmation Dialog */}
      <DeleteFolderModal
        isOpen={Boolean(deleteModalState?.isOpen)}
        onClose={() => setDeleteModalState(null)}
        onConfirm={handleConfirmDeleteFolder}
        folderName={deleteModalState?.folderName}
        folderCount={deleteModalState?.isBulk ? deleteModalState.bulkIds?.length : 1}
      />
      {/* Search Bar */}
      <div className="p-2.5 border-b border-apple-border dark:border-apple-borderDark">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search all notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-[#EFE7D8]/80 dark:bg-[#1C2733] border border-[#DFD3C0]/70 dark:border-[#223344] focus:border-[#213A50] dark:focus:border-[#4B708B] text-[#1C2B36] dark:text-[#E8EEF3] placeholder-[#8A9BA8] outline-none focus:outline-none focus:ring-0 transition-colors duration-150"
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
            {!searchQuery && currentFolder?.id !== 'trash' && !isSelectionMode && (
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
          <div className="grid grid-cols-2 gap-3">
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
                <div className={isSelectionMode ? "space-y-3" : "space-y-1.5"}>
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
              searchQuery.trim().length > 0 ? (
                <div className="space-y-1">
                  <div className={isSelectionMode ? "space-y-3" : "space-y-1.5"}>
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
              ) : (
                <div className="space-y-3">
                  {notesByBucket.map(group => (
                    <div key={group.bucket} className="space-y-1">
                      <div className="px-2 text-[10px] font-semibold text-[#8A9BA8] dark:text-[#6E8092] uppercase tracking-wider">
                        {group.bucket}
                      </div>
                      <div className={isSelectionMode ? "space-y-3" : "space-y-1.5"}>
                        {group.notes.map(note => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            isSelected={note.id === activeNoteId}
                            viewMode="list"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bottom Toolbar (Active during Multi-Select) */}
      {isSelectionMode && (
        <div className="border-t border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/95 dark:bg-[#131B24]/95 backdrop-blur-md px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-lg">
          {selectedFolderId === 'trash' ? (
            <>
              {/* Restore */}
              <button
                onClick={restoreSelectedNotes}
                disabled={selectedNoteIds.length === 0}
                className="flex flex-col items-center space-y-1 text-neutral-700 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <RotateCcw size={18} />
                <span className="text-[10px] font-medium">Restore</span>
              </button>

              {/* Delete Permanently */}
              <button
                onClick={deleteSelectedNotes}
                disabled={selectedNoteIds.length === 0}
                className="flex flex-col items-center space-y-1 text-red-500 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Trash2 size={18} />
                <span className="text-[10px] font-medium">Delete Forever</span>
              </button>
            </>
          ) : (
            <>
              {/* Move to folder */}
              <button
                onClick={() => {
                  triggerHaptic();
                  setShowMovePicker(true);
                }}
                disabled={selectedNoteIds.length === 0}
                className="flex flex-col items-center space-y-1 text-neutral-700 dark:text-[#CBD8E3] hover:text-apple-yellow dark:hover:text-[#7EAAD0] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <FolderInput size={18} />
                <span className="text-[10px] font-medium">Move</span>
              </button>

              {/* Pin / Unpin */}
              <button
                onClick={togglePinSelectedNotes}
                disabled={selectedNoteIds.length === 0}
                className="flex flex-col items-center space-y-1 text-neutral-700 dark:text-[#CBD8E3] hover:text-apple-yellow dark:hover:text-[#7EAAD0] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Pin size={18} />
                <span className="text-[10px] font-medium">Pin / Unpin</span>
              </button>

              {/* Delete */}
              <button
                onClick={deleteSelectedNotes}
                disabled={selectedNoteIds.length === 0}
                className="flex flex-col items-center space-y-1 text-red-500 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Trash2 size={18} />
                <span className="text-[10px] font-medium">Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Move Notes Folder Picker Bottom Sheet */}
      {showMovePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setShowMovePicker(false)}
          />

          <div
            className="relative w-full max-w-sm bg-[#EFE7D8] dark:bg-[#131B24] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#DFD3C0] dark:border-[#223344] overflow-hidden flex flex-col max-h-[82vh] animate-in slide-in-from-bottom duration-250 z-10"
            role="dialog"
            aria-modal="true"
          >
            {/* Grabber */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
              <div className="w-9 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#DFD3C0]/70 dark:border-[#223344]">
              <div className="flex items-center space-x-2">
                <FolderInput size={17} className="text-[#395060] dark:text-[#7EAAD0]" />
                <h3 className="text-sm font-semibold text-[#1C2B36] dark:text-[#E8EEF3]">
                  Move {selectedNoteIds.length} {selectedNoteIds.length === 1 ? 'Note' : 'Notes'} To
                </h3>
              </div>
              <button
                onClick={() => setShowMovePicker(false)}
                className="text-xs font-semibold text-apple-yellow hover:text-apple-yellowHover dark:text-[#7EAAD0] dark:hover:text-[#9DC3E6] py-1 px-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Folder choices */}
            <div className="p-3 space-y-3 overflow-y-auto">
              <div className="bg-[#FAF6EF] dark:bg-[#1C2733] rounded-xl overflow-hidden shadow-xs divide-y divide-[#DFD3C0]/50 dark:divide-[#223344]">
                <button
                  onClick={() => {
                    moveSelectedNotesToFolder('default');
                    setShowMovePicker(false);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-md bg-[#E8F1F7] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] flex items-center justify-center shrink-0">
                      <Folder size={14} />
                    </div>
                    <span className="font-medium">Notes</span>
                  </div>
                  {selectedFolderId === 'default' && (
                    <span className="text-[10px] text-neutral-400">Current</span>
                  )}
                </button>

                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      moveSelectedNotesToFolder(f.id);
                      setShowMovePicker(false);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2.5 truncate pr-2">
                      <div className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                        <Folder size={14} />
                      </div>
                      <span className="font-medium truncate">{f.name}</span>
                    </div>
                    {selectedFolderId === f.id && (
                      <span className="text-[10px] text-neutral-400">Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

