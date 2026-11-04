import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  SquarePen,
  Sun,
  Moon,
  Download,
  CheckSquare,
  Type,
  FolderOpen,
  ChevronLeft,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { triggerHaptic } from '../../utils/haptics';

interface TopNavbarProps {
  onToggleChecklist?: () => void;
  onFormatClick?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onToggleChecklist, onFormatClick }) => {
  const {
    toggleSidebar,
    isSidebarOpen,
    viewMode,
    setViewMode,
    activeNote,
    deleteNote,
    createNote,
    theme,
    toggleTheme,
    exportCurrentNote,
    currentFolder,
    mobileView,
    setMobileView,
  } = useNotes();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 border-b border-apple-border dark:border-apple-borderDark bg-[#f6f6f6]/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md flex items-center justify-between px-3 shrink-0 select-none transition-colors pt-[env(safe-area-inset-top)] [app-region:drag] md:[app-region:drag]">
      {/* Left controls: Traffic light clearance on Mac + navigation */}
      <div className="flex items-center space-x-1.5 [app-region:no-drag]">
        {/* Mobile Back Button (when inside editor on phone) */}
        {mobileView === 'editor' && (
          <button
            onClick={() => {
              triggerHaptic();
              setMobileView('list');
            }}
            className="md:hidden flex items-center space-x-1 text-apple-yellow hover:text-apple-yellowHover text-xs font-semibold py-1 px-1 rounded active:opacity-70"
          >
            <ChevronLeft size={18} />
            <span>Notes</span>
          </button>
        )}

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'Hide Folders' : 'Show Folders'}
          className={`hidden md:flex p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors ${
            isSidebarOpen ? 'bg-neutral-200/60 dark:bg-neutral-800/60' : ''
          }`}
        >
          <PanelLeft size={18} />
        </button>

        <div className="hidden md:block h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        {/* View Mode Toggle (Desktop only) */}
        <div className="hidden md:flex bg-neutral-200 dark:bg-neutral-800 rounded-md p-0.5">
          <button
            onClick={() => {
              triggerHaptic();
              setViewMode('list');
            }}
            title="List View"
            className={`p-1 rounded text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ListIcon size={15} />
          </button>
          <button
            onClick={() => {
              triggerHaptic();
              setViewMode('gallery');
            }}
            title="Gallery View"
            className={`p-1 rounded text-xs transition-colors ${
              viewMode === 'gallery'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {/* Delete note button */}
        {activeNote && (
          <button
            onClick={() => deleteNote(activeNote.id)}
            title={activeNote.isTrash ? 'Permanently Delete' : 'Move Note to Trash'}
            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-950/40 text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1 active:scale-95"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {/* Center: Folder / App title */}
      <div className="flex items-center space-x-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 pointer-events-none">
        <FolderOpen size={14} className="text-apple-yellow" />
        <span className="truncate max-w-[140px] sm:max-w-xs">{currentFolder?.name || 'Notes'}</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 [app-region:no-drag]">
        {/* Checklist shortcut */}
        <button
          onClick={() => {
            triggerHaptic();
            onToggleChecklist?.();
          }}
          title="Insert Checklist"
          disabled={!activeNote || activeNote.isTrash}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
        >
          <CheckSquare size={17} />
        </button>

        {/* Format toolbar toggle */}
        <button
          onClick={() => {
            triggerHaptic();
            onFormatClick?.();
          }}
          title="Text Formatting"
          disabled={!activeNote || activeNote.isTrash}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
        >
          <Type size={17} />
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!activeNote}
            title="Export Note"
            className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
          >
            <Download size={17} />
          </button>

          {showExportMenu && activeNote && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider text-[10px]">
                Export Note As
              </div>
              <button
                onClick={() => {
                  exportCurrentNote('markdown');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
              >
                Markdown (.md)
              </button>
              <button
                onClick={() => {
                  exportCurrentNote('txt');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
              >
                Plain Text (.txt)
              </button>
              <button
                onClick={() => {
                  exportCurrentNote('html');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
              >
                HTML (.html)
              </button>
            </div>
          )}
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors active:scale-95"
        >
          {theme === 'dark' ? <Sun size={17} className="text-yellow-400" /> : <Moon size={17} />}
        </button>

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        {/* New Note Button */}
        <button
          onClick={() => createNote()}
          title="Create New Note (Cmd/Ctrl + N)"
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover active:scale-95 text-white shadow-sm font-medium text-xs transition-all"
        >
          <SquarePen size={15} />
          <span className="hidden sm:inline">New Note</span>
        </button>
      </div>
    </header>
  );
};
