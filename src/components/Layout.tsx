import React, { useState, useRef, useEffect } from 'react';
import { TopNavbar } from './Header/TopNavbar';
import { FolderList } from './Sidebar/FolderList';
import { NotesList } from './NotesList/NotesList';
import { Editor } from './Editor/Editor';
import { useNotes } from '../store/NotesContext';
import { Plus } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const Layout: React.FC = () => {
  const { isSidebarOpen, createNote, mobileView } = useNotes();
  const [showFormatToolbar, setShowFormatToolbar] = useState(true);
  const checklistActionRef = useRef<(() => void) | null>(null);

  // Global Keyboard Shortcuts (Cmd/Ctrl + N for new note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNote]);

  const handleToggleChecklist = () => {
    if (checklistActionRef.current) {
      checklistActionRef.current();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f6f6] dark:bg-[#1e1e1e] font-sans pb-[env(safe-area-inset-bottom)] select-none">
      {/* Top Navbar */}
      <TopNavbar
        onToggleChecklist={handleToggleChecklist}
        onFormatClick={() => setShowFormatToolbar(prev => !prev)}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop 3-Pane Layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {/* Pane 1: Folders / Tags Sidebar */}
          {isSidebarOpen && <FolderList />}

          {/* Pane 2: Notes List & Search */}
          <NotesList />

          {/* Pane 3: Rich Text Editor */}
          <Editor
            showToolbar={showFormatToolbar}
            onRegisterToggleChecklist={(fn) => {
              checklistActionRef.current = fn;
            }}
          />
        </div>

        {/* Mobile / Android Responsive Layout */}
        <div className="flex md:hidden flex-1 overflow-hidden relative">
          {mobileView === 'list' ? (
            <div className="w-full h-full flex flex-col relative">
              <NotesList />
              {/* Android Floating Action Button (FAB) */}
              <button
                onClick={() => {
                  triggerHaptic();
                  createNote();
                }}
                className="absolute right-5 bottom-6 w-14 h-14 rounded-full bg-apple-yellow text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30"
                title="New Note"
              >
                <Plus size={28} />
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <Editor
                showToolbar={showFormatToolbar}
                onRegisterToggleChecklist={(fn) => {
                  checklistActionRef.current = fn;
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
