import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft,
  LayoutGrid,
  List as ListIcon,
  SquarePen,
  Sun,
  Moon,
  Download,
  ChevronLeft,
  Sparkles,
  Cloud,
  Trash2,
} from 'lucide-react';
import { useNotes } from '../../store/NotesContext';
import { useAuth } from '../../store/AuthContext';
import { triggerHaptic } from '../../utils/haptics';

interface TopNavbarProps {
  onToggleChecklist?: () => void;
  onFormatClick?: () => void;
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onCheckUpdates,
  hasUpdate,
}) => {
  const {
    toggleSidebar,
    isSidebarOpen,
    viewMode,
    setViewMode,
    activeNote,
    createNote,
    deleteNote,
    theme,
    toggleTheme,
    exportCurrentNote,
    mobileView,
    setMobileView,
  } = useNotes();
  const { user, openAuthModal, syncStatus } = useAuth();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isMacApp, setIsMacApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      Boolean(window.electronAPI?.isMac) ||
      (navigator.userAgent.includes('Electron') && /Mac/i.test(navigator.userAgent))
    );
  });
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.electronAPI?.isMac) {
      setIsMacApp(true);
    }
  }, []);

  // Close export dropdown when clicking or tapping outside
  useEffect(() => {
    if (!showExportMenu) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showExportMenu]);

  const noteToExport = activeNote;

  return (
    <header className="h-12 border-b border-apple-border dark:border-apple-borderDark bg-[#f6f6f6]/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md flex items-center justify-between pr-3 shrink-0 select-none transition-colors pt-[env(safe-area-inset-top)] [app-region:drag] relative z-40">
      {/* Left controls: Traffic light clearance on Mac + navigation */}
      <div className="flex items-center space-x-1.5 [app-region:no-drag]">
        {/* Dedicated clearance spacer for macOS window traffic lights */}
        {isMacApp ? (
          <div className="w-[78px] h-12 shrink-0 [app-region:drag]" aria-hidden="true" />
        ) : (
          <div className="w-2" />
        )}

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
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 [app-region:no-drag]">
        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic();
              setShowExportMenu((prev) => !prev);
            }}
            disabled={!noteToExport}
            title={noteToExport ? `Export "${noteToExport.title || 'Untitled'}"` : 'Select a note to export'}
            className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
          >
            <Download size={17} />
          </button>

          {showExportMenu && noteToExport && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#252525] rounded-xl shadow-2xl border border-neutral-200/90 dark:border-neutral-700/80 py-1.5 z-50 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider text-[10px]">
                Export Note As
              </div>
              <button
                type="button"
                onClick={() => {
                  exportCurrentNote('markdown', noteToExport);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 transition-colors"
              >
                Markdown (.md)
              </button>
              <button
                type="button"
                onClick={() => {
                  exportCurrentNote('txt', noteToExport);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 transition-colors"
              >
                Plain Text (.txt)
              </button>
              <button
                type="button"
                onClick={() => {
                  exportCurrentNote('html', noteToExport);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 transition-colors"
              >
                HTML (.html)
              </button>
            </div>
          )}
        </div>

        {/* Update notification button (if available) */}
        {hasUpdate && (
          <button
            onClick={() => {
              triggerHaptic();
              onCheckUpdates?.();
            }}
            title="Software Update Available"
            className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-all active:scale-95"
          >
            <Sparkles size={13} className="text-apple-yellow animate-pulse" />
            <span className="hidden sm:inline">Update</span>
          </button>
        )}

        {/* Cloud Sync Button */}
        <button
          onClick={() => {
            triggerHaptic();
            openAuthModal();
          }}
          title={
            user
              ? `Cloud Sync Active (${user.email}) • Status: ${syncStatus}`
              : 'Sign in to Sync with Cloud'
          }
          className={`flex items-center space-x-1 p-1.5 rounded-md transition-colors active:scale-95 ${
            user
              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Cloud size={17} />
          {user && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'syncing'
                  ? 'bg-amber-400 animate-ping'
                  : syncStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
            />
          )}
        </button>

        {/* Dark/Light toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors active:scale-95"
        >
          {theme === 'dark' ? <Sun size={17} className="text-yellow-400" /> : <Moon size={17} />}
        </button>

        <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

        {/* Action Button: On mobile inside a note, show Delete option. Otherwise New Note */}
        {mobileView === 'editor' && activeNote ? (
          <>
            <button
              onClick={() => {
                triggerHaptic();
                deleteNote(activeNote.id);
                setMobileView('list');
              }}
              title="Delete Note"
              className="md:hidden flex items-center justify-center p-2 rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all"
            >
              <Trash2 size={17} />
            </button>
            <button
              onClick={() => createNote()}
              title="Create New Note (Cmd/Ctrl + N)"
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover active:scale-95 text-white shadow-sm font-medium text-xs transition-all"
            >
              <SquarePen size={15} />
              <span>New Note</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => createNote()}
            title="Create New Note (Cmd/Ctrl + N)"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover active:scale-95 text-white shadow-sm font-medium text-xs transition-all"
          >
            <SquarePen size={15} />
            <span className="hidden sm:inline">New Note</span>
          </button>
        )}
      </div>
    </header>
  );
};
