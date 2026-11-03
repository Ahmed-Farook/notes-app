import React, { useState, useRef, useEffect } from 'react';
import { TopNavbar } from './Header/TopNavbar';
import { FolderList } from './Sidebar/FolderList';
import { NotesList } from './NotesList/NotesList';
import { Editor } from './Editor/Editor';
import { useNotes } from '../store/NotesContext';

export const Layout: React.FC = () => {
  const { isSidebarOpen, createNote, activeNote, deleteNote } = useNotes();
  const [showFormatToolbar, setShowFormatToolbar] = useState(true);
  const checklistActionRef = useRef<(() => void) | null>(null);

  // Global Keyboard Shortcuts (Cmd/Ctrl + N for new note, etc.)
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f6f6] dark:bg-[#1e1e1e] font-sans">
      {/* Top Navbar */}
      <TopNavbar
        onToggleChecklist={handleToggleChecklist}
        onFormatClick={() => setShowFormatToolbar(prev => !prev)}
      />

      {/* Main 3-Pane Body */}
      <div className="flex flex-1 overflow-hidden relative">
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
    </div>
  );
};
