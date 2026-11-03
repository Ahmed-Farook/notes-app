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
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';

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
    <header className="h-12 border-b border-apple-border dark:border-apple-borderDark bg-[#f6f6f6] dark:bg-[#1e1e1e] flex items-center justify-between px-3 shrink-0 select-none transition-colors">
      {/* Left controls */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'Hide Folders' : 'Show Folders'}
          className={`p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors ${
            isSidebarOpen ? 'bg-neutral-200/60 dark:bg-neutral-800/60' : ''
          }`}
        >
          <PanelLeft size={18} />
        </button>

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        {/* View Mode Toggle */}
        <div className="flex bg-neutral-200 dark:bg-neutral-800 rounded-md p-0.5">
          <button
            onClick={() => setViewMode('list')}
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
            onClick={() => setViewMode('gallery')}
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
            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-950/40 text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {/* Center: Folder / App title */}
      <div className="flex items-center space-x-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <FolderOpen size={14} className="text-apple-yellow" />
        <span>{currentFolder?.name || 'Notes'}</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-1.5">
        {/* Checklist shortcut */}
        <button
          onClick={onToggleChecklist}
          title="Insert Checklist"
          disabled={!activeNote || activeNote.isTrash}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <CheckSquare size={17} />
        </button>

        {/* Format toolbar toggle */}
        <button
          onClick={onFormatClick}
          title="Text Formatting"
          disabled={!activeNote || activeNote.isTrash}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Type size={17} />
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!activeNote}
            title="Export Note"
            className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Download size={17} />
          </button>

          {showExportMenu && activeNote && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 z-50 text-xs">
              <div className="px-3 py-1 font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider text-[10px]">
                Export Note As
              </div>
              <button
                onClick={() => {
                  exportCurrentNote('markdown');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-between"
              >
                <span>Markdown (.md)</span>
              </button>
              <button
                onClick={() => {
                  exportCurrentNote('txt');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-between"
              >
                <span>Plain Text (.txt)</span>
              </button>
              <button
                onClick={() => {
                  exportCurrentNote('html');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-between"
              >
                <span>HTML (.html)</span>
              </button>
            </div>
          )}
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
        >
          {theme === 'dark' ? <Sun size={17} className="text-yellow-400" /> : <Moon size={17} />}
        </button>

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        {/* New Note Button (Apple signature amber pencil) */}
        <button
          onClick={() => createNote()}
          title="Create New Note (Cmd/Ctrl + N)"
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover text-white shadow-sm font-medium text-xs transition-colors"
        >
          <SquarePen size={15} />
          <span className="hidden sm:inline">New Note</span>
        </button>
      </div>
    </header>
  );
};

