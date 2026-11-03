import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Note, Folder, ViewMode } from '../types/note';
import {
  loadStoredNotes,
  saveStoredNotes,
  loadStoredFolders,
  saveStoredFolders,
  SYSTEM_FOLDERS,
} from '../utils/storage';

interface NotesContextType {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;
  selectedFolderId: string;
  searchQuery: string;
  viewMode: ViewMode;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  filteredNotes: Note[];
  pinnedNotes: Note[];
  unpinnedNotes: Note[];
  currentFolder: Folder | undefined;
  
  // Actions
  setActiveNoteId: (id: string | null) => void;
  setSelectedFolderId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  
  createNote: (folderId?: string) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  moveNoteToFolder: (noteId: string, folderId: string) => void;
  
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  exportCurrentNote: (formatType: 'markdown' | 'txt' | 'html') => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>(() => loadStoredNotes());
  const [folders, setFolders] = useState<Folder[]>(() => loadStoredFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const initial = loadStoredNotes();
    return initial.length > 0 ? initial[0].id : null;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apple_notes_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Apply dark mode class to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('apple_notes_theme', theme);
  }, [theme]);

  // Persist notes
  useEffect(() => {
    saveStoredNotes(notes);
  }, [notes]);

  // Persist folders
  useEffect(() => {
    saveStoredFolders(folders);
  }, [folders]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const allFolders = useMemo(() => {
    return [...SYSTEM_FOLDERS, ...folders];
  }, [folders]);

  const currentFolder = useMemo(() => {
    return allFolders.find(f => f.id === selectedFolderId) || SYSTEM_FOLDERS[0];
  }, [allFolders, selectedFolderId]);

  // Filter notes based on folder and search query
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // 1. Folder filter
      if (selectedFolderId === 'trash') {
        if (!note.isTrash) return false;
      } else {
        if (note.isTrash) return false;
        if (selectedFolderId === 'all') {
          // all non-trash notes
        } else if (selectedFolderId === 'quick') {
          if (note.folderId !== 'quick') return false;
        } else {
          if (note.folderId !== selectedFolderId) return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(query);
        const matchesContent = note.plainTextPreview.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent) return false;
      }

      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, selectedFolderId, searchQuery]);

  const pinnedNotes = useMemo(() => {
    return filteredNotes.filter(n => n.isPinned);
  }, [filteredNotes]);

  const unpinnedNotes = useMemo(() => {
    return filteredNotes.filter(n => !n.isPinned);
  }, [filteredNotes]);

  // Active note instance
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Create new note
  const createNote = (folderId?: string): Note => {
    const targetFolder = folderId || (selectedFolderId === 'trash' || selectedFolderId === 'all' ? 'default' : selectedFolderId);
    
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: 'New Note',
      content: '<h1>New Note</h1><p></p>',
      plainTextPreview: 'No additional text',
      folderId: targetFolder,
      isPinned: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    return newNote;
  };

  // Update note
  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          return {
            ...note,
            ...updates,
            updatedAt: Date.now(),
          };
        }
        return note;
      })
    );
  };

  // Delete note (move to trash or permanently if already in trash)
  const deleteNote = (id: string) => {
    setNotes(prev => {
      const note = prev.find(n => n.id === id);
      if (!note) return prev;

      if (note.isTrash) {
        // Permanently delete
        return prev.filter(n => n.id !== id);
      } else {
        // Move to trash
        return prev.map(n => (n.id === id ? { ...n, isTrash: true, updatedAt: Date.now() } : n));
      }
    });

    // Auto switch active note if the deleted one was active
    if (activeNoteId === id) {
      const remaining = filteredNotes.filter(n => n.id !== id);
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const permanentlyDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNoteId === id) {
      const remaining = filteredNotes.filter(n => n.id !== id);
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const restoreNote = (id: string) => {
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, isTrash: false, updatedAt: Date.now() } : n))
    );
  };

  const togglePinNote = (id: string) => {
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const moveNoteToFolder = (noteId: string, folderId: string) => {
    setNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, folderId, updatedAt: Date.now() } : n))
    );
  };

  const createFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: trimmed,
    };
    setFolders(prev => [...prev, newFolder]);
    setSelectedFolderId(newFolder.id);
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    // Move notes in this folder to default folder
    setNotes(prev =>
      prev.map(n => (n.folderId === id ? { ...n, folderId: 'default' } : n))
    );
    if (selectedFolderId === id) {
      setSelectedFolderId('all');
    }
  };

  // Export current note
  const exportCurrentNote = (formatType: 'markdown' | 'txt' | 'html') => {
    if (!activeNote) return;

    let contentToExport = activeNote.content;
    let filename = `${activeNote.title || 'Untitled'}.${formatType === 'markdown' ? 'md' : formatType}`;
    let mimeType = 'text/plain';

    if (formatType === 'txt') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = activeNote.content;
      contentToExport = tempDiv.textContent || tempDiv.innerText || '';
    } else if (formatType === 'markdown') {
      // Simple html-to-markdown basic converter
      contentToExport = activeNote.content
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i>(.*?)<\/i>/gi, '*$1*')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      mimeType = 'text/markdown';
    } else if (formatType === 'html') {
      contentToExport = `<!DOCTYPE html><html><head><title>${activeNote.title}</title><meta charset="utf-8"></head><body>${activeNote.content}</body></html>`;
      mimeType = 'text/html';
    }

    const blob = new Blob([contentToExport], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        folders,
        activeNoteId,
        activeNote,
        selectedFolderId,
        searchQuery,
        viewMode,
        isSidebarOpen,
        theme,
        filteredNotes,
        pinnedNotes,
        unpinnedNotes,
        currentFolder,
        setActiveNoteId,
        setSelectedFolderId,
        setSearchQuery,
        setViewMode,
        toggleSidebar,
        toggleTheme,
        createNote,
        updateNote,
        deleteNote,
        restoreNote,
        permanentlyDeleteNote,
        togglePinNote,
        moveNoteToFolder,
        createFolder,
        deleteFolder,
        exportCurrentNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};

