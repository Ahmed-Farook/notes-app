import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Note, Folder, ViewMode } from '../types/note';
import {
  loadStoredNotes,
  saveStoredNotes,
  loadStoredFolders,
  saveStoredFolders,
  SYSTEM_FOLDERS,
  INITIAL_NOTES,
} from '../utils/storage';
import { triggerHaptic } from '../utils/haptics';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchUserNotes,
  fetchUserFolders,
  upsertNoteToCloud,
  deleteNoteFromCloud,
  upsertFolderToCloud,
  deleteFolderFromCloud,
  mergeNotes,
  mergeFolders,
  dbToNote,
  dbToFolder,
  DbNote,
  DbFolder,
} from '../utils/supabaseSync';

interface NotesContextType {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeNote: Note | null;
  selectedFolderId: string;
  searchQuery: string;
  viewMode: ViewMode;
  isSidebarOpen: boolean;
  mobileView: 'list' | 'editor';
  theme: 'light' | 'dark';
  filteredNotes: Note[];
  pinnedNotes: Note[];
  unpinnedNotes: Note[];
  currentFolder: Folder | undefined;
  isFolderPickerOpen: boolean;

  // Multi-selection state & actions
  isSelectionMode: boolean;
  selectedNoteIds: string[];
  enterSelectionMode: (initialNoteId?: string) => void;
  exitSelectionMode: () => void;
  toggleSelectNote: (noteId: string) => void;
  selectAllNotes: () => void;
  deselectAllNotes: () => void;
  deleteSelectedNotes: () => void;
  togglePinSelectedNotes: () => void;
  moveSelectedNotesToFolder: (folderId: string) => void;
  restoreSelectedNotes: () => void;

  // Actions
  setActiveNoteId: (id: string | null) => void;
  setSelectedFolderId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setMobileView: (view: 'list' | 'editor') => void;
  setIsFolderPickerOpen: (open: boolean) => void;
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
  renameFolder: (id: string, newName: string) => void;
  deleteFolder: (id: string) => void;
  exportCurrentNote: (formatType: 'markdown' | 'txt' | 'html', noteToExport?: Note) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>(() => loadStoredNotes());
  const [folders, setFolders] = useState<Folder[]>(() => loadStoredFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState<boolean>(false);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apple_notes_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const { user, setSyncStatus, encryptionKey } = useAuth();
  const encryptionKeyRef = useRef<CryptoKey | null>(encryptionKey);
  useEffect(() => {
    encryptionKeyRef.current = encryptionKey;
  }, [encryptionKey]);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const cloudSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with Supabase on user sign-in & listen to Realtime changes
  useEffect(() => {
    if (!user || !encryptionKey) return;

    let isMounted = true;
    setSyncStatus('syncing');

    // 1. Initial hydration & bidirectional merge
    const hydrateAndSync = async () => {
      try {
        const [remoteNotes, remoteFolders] = await Promise.all([
          fetchUserNotes(encryptionKey),
          fetchUserFolders(encryptionKey),
        ]);

        if (!isMounted) return;

        let effectiveRemoteNotes = remoteNotes;
        // Clean up legacy 3 default sample notes from Supabase cloud if present
        const isLegacySampleSet =
          remoteNotes.length === 3 &&
          remoteNotes.some(n => n.id === 'note-roadmap') &&
          remoteNotes.some(n => n.id === 'note-weekend-ideas');

        if (isLegacySampleSet) {
          await Promise.all([
            deleteNoteFromCloud('note-roadmap'),
            deleteNoteFromCloud('note-weekend-ideas'),
          ]);
          effectiveRemoteNotes = INITIAL_NOTES;
        }

        const { merged: mergedNotes, toUpload: notesToUpload } = mergeNotes(
          notesRef.current,
          effectiveRemoteNotes
        );
        const { merged: mergedFolders, toUpload: foldersToUpload } = mergeFolders(
          foldersRef.current,
          remoteFolders
        );

        setNotes(mergedNotes);
        setFolders(mergedFolders);
        setSyncStatus('synced');

        // Upload any local items not yet in cloud (encrypted with E2EE key)
        for (const n of notesToUpload) {
          upsertNoteToCloud(n, user.id, encryptionKey);
        }
        for (const f of foldersToUpload) {
          upsertFolderToCloud(f, user.id, encryptionKey);
        }
      } catch (err) {
        console.warn('Sync error:', err);
        setSyncStatus('offline');
      }
    };

    hydrateAndSync();

    // 2. Realtime WebSocket subscription
    const channel = supabase
      .channel('apple_notes_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, async (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const remoteNote = await dbToNote(payload.new as DbNote, encryptionKeyRef.current);
          setNotes(prev => {
            const idx = prev.findIndex(n => n.id === remoteNote.id);
            if (idx >= 0) {
              if (remoteNote.updatedAt >= prev[idx].updatedAt) {
                const copy = [...prev];
                copy[idx] = remoteNote;
                return copy;
              }
              return prev;
            }
            return [remoteNote, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setNotes(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, async (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const remoteFolder = await dbToFolder(payload.new as DbFolder, encryptionKeyRef.current);
          setFolders(prev => {
            const idx = prev.findIndex(f => f.id === remoteFolder.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = remoteFolder;
              return copy;
            }
            return [...prev, remoteFolder];
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setFolders(prev => prev.filter(f => f.id !== deletedId));
          }
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, encryptionKey, setSyncStatus]);

  // Apply dark mode class to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('apple_notes_theme', theme);
  }, [theme]);

  // Snappy debounced persistence: never blocks typing or UI updates
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStoredNotes(notes);
    }, 250);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [notes]);

  // Flush pending save on window blur / hide
  useEffect(() => {
    const handleFlush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveStoredNotes(notes);
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
    };
  }, [notes]);

  // Persist folders
  useEffect(() => {
    saveStoredFolders(folders);
  }, [folders]);

  // Listen to native Electron bridge actions if available
  useEffect(() => {
    const electronAPI = (window as unknown as { electronAPI?: { sendNewNote: (cb: () => void) => void } })?.electronAPI;
    if (electronAPI?.sendNewNote) {
      electronAPI.sendNewNote(() => {
        createNote();
      });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    triggerHaptic();
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleSidebar = useCallback(() => {
    triggerHaptic();
    setIsSidebarOpen(prev => !prev);
  }, []);

  const allFolders = useMemo(() => {
    return [...SYSTEM_FOLDERS, ...folders];
  }, [folders]);

  const currentFolder = useMemo(() => {
    return allFolders.find(f => f.id === selectedFolderId) || SYSTEM_FOLDERS[0];
  }, [allFolders, selectedFolderId]);

  // Filter notes based on folder and search query
  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return notes.filter(note => {
      // 1. If searching, search across all active notes (or trash if in trash folder)
      if (query) {
        if (selectedFolderId === 'trash') {
          if (!note.isTrash) return false;
        } else {
          if (note.isTrash) return false;
        }

        // Comprehensive full-text search: title, preview snippet, and full note body
        const matchesTitle = note.title.toLowerCase().includes(query);
        const matchesSnippet = note.plainTextPreview.toLowerCase().includes(query);
        // Strip HTML tags so entire note body text is searched
        const cleanBody = note.content.replace(/<[^>]*>/g, ' ').toLowerCase();
        const matchesBody = cleanBody.includes(query);

        return matchesTitle || matchesSnippet || matchesBody;
      }

      // 2. Folder filter when not searching
      if (selectedFolderId === 'trash') {
        if (!note.isTrash) return false;
      } else {
        if (note.isTrash) return false;
        const noteFolder = note.folderId || 'default';
        if (selectedFolderId === 'default') {
          // Main Notes section contains default notes and legacy quick/all
          if (noteFolder !== 'default' && noteFolder !== 'quick' && noteFolder !== 'all') {
            return false;
          }
        } else {
          if (noteFolder !== selectedFolderId) return false;
        }
      }

      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, selectedFolderId, searchQuery]);

  const pinnedNotes = useMemo(() => {
    if (selectedFolderId === 'trash') return [];
    return filteredNotes.filter(n => n.isPinned);
  }, [filteredNotes, selectedFolderId]);

  const unpinnedNotes = useMemo(() => {
    if (selectedFolderId === 'trash') return filteredNotes;
    return filteredNotes.filter(n => !n.isPinned);
  }, [filteredNotes, selectedFolderId]);

  // Active note instance
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Only update active note if an active note is no longer in the list (e.g. moved or deleted)
  useEffect(() => {
    if (activeNoteId) {
      const activeStillInList = filteredNotes.some(n => n.id === activeNoteId);
      if (!activeStillInList) {
        setActiveNoteId(null);
      }
    }
  }, [filteredNotes, activeNoteId]);

  // Create new note
  const createNote = useCallback((folderId?: string): Note => {
    triggerHaptic();
    const targetFolder =
      folderId ||
      (selectedFolderId === 'trash'
        ? 'default'
        : selectedFolderId);

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
    setMobileView('editor');

    if (user) {
      upsertNoteToCloud(newNote, user.id, encryptionKeyRef.current);
    }
    return newNote;
  }, [selectedFolderId, user]);

  // Update note
  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          const hasContentChanged =
            (updates.content !== undefined && updates.content !== note.content) ||
            (updates.title !== undefined && updates.title !== note.title) ||
            (updates.plainTextPreview !== undefined && updates.plainTextPreview !== note.plainTextPreview);

          const newUpdatedAt = hasContentChanged ? Date.now() : (updates.updatedAt ?? note.updatedAt);

          const updated: Note = {
            ...note,
            ...updates,
            updatedAt: newUpdatedAt,
          };

          if (user && hasContentChanged) {
            if (cloudSaveTimers.current[id]) {
              clearTimeout(cloudSaveTimers.current[id]);
            }
            cloudSaveTimers.current[id] = setTimeout(() => {
              upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
              delete cloudSaveTimers.current[id];
            }, 500);
          }

          return updated;
        }
        return note;
      })
    );
  }, [user]);

  // Delete note
  const deleteNote = useCallback((id: string) => {
    triggerHaptic();
    setNotes(prev => {
      const note = prev.find(n => n.id === id);
      if (!note) return prev;

      if (note.isTrash) {
        if (user) {
          deleteNoteFromCloud(id);
        }
        return prev.filter(n => n.id !== id);
      } else {
        // Automatically unpin note when moving to trash
        const trashed: Note = { ...note, isTrash: true, isPinned: false };
        if (user) {
          upsertNoteToCloud(trashed, user.id, encryptionKeyRef.current);
        }
        return prev.map(n => (n.id === id ? trashed : n));
      }
    });

    if (activeNoteId === id) {
      const remaining = filteredNotes.filter(n => n.id !== id);
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      if (remaining.length === 0) {
        setMobileView('list');
      }
    }
  }, [activeNoteId, filteredNotes, user]);

  const permanentlyDeleteNote = useCallback((id: string) => {
    triggerHaptic();
    setNotes(prev => prev.filter(n => n.id !== id));
    if (user) {
      deleteNoteFromCloud(id);
    }
    if (activeNoteId === id) {
      const remaining = filteredNotes.filter(n => n.id !== id);
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      if (remaining.length === 0) {
        setMobileView('list');
      }
    }
  }, [activeNoteId, filteredNotes, user]);

  const restoreNote = useCallback((id: string) => {
    triggerHaptic();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          const restored: Note = { ...n, isTrash: false, updatedAt: Date.now() };
          if (user) {
            upsertNoteToCloud(restored, user.id, encryptionKeyRef.current);
          }
          return restored;
        }
        return n;
      })
    );
  }, [user]);

  const togglePinNote = useCallback((id: string) => {
    triggerHaptic();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          // Do not bump updatedAt when toggling pin (ordering based on edit time)
          const updated: Note = { ...n, isPinned: !n.isPinned };
          if (user) {
            upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          }
          return updated;
        }
        return n;
      })
    );
  }, [user]);

  const moveNoteToFolder = useCallback((noteId: string, folderId: string) => {
    setNotes(prev =>
      prev.map(n => {
        if (n.id === noteId) {
          // Do not bump updatedAt when moving folders
          const updated: Note = { ...n, folderId };
          if (user) {
            upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          }
          return updated;
        }
        return n;
      })
    );
  }, [user]);

  const createFolder = useCallback((name: string) => {
    triggerHaptic();
    const trimmed = name.trim();
    if (!trimmed) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: trimmed,
    };
    setFolders(prev => [...prev, newFolder]);
    setSelectedFolderId(newFolder.id);
    if (user) {
      upsertFolderToCloud(newFolder, user.id, encryptionKeyRef.current);
    }
  }, [user]);

  const renameFolder = useCallback((id: string, newName: string) => {
    triggerHaptic();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setFolders(prev =>
      prev.map(f => {
        if (f.id === id) {
          const updated = { ...f, name: trimmed };
          if (user) {
            upsertFolderToCloud(updated, user.id, encryptionKeyRef.current);
          }
          return updated;
        }
        return f;
      })
    );
  }, [user]);

  const deleteFolder = useCallback((id: string) => {
    triggerHaptic();
    setFolders(prev => prev.filter(f => f.id !== id));
    setNotes(prev =>
      prev.map(n => (n.folderId === id ? { ...n, folderId: 'default' } : n))
    );
    if (selectedFolderId === id) {
      setSelectedFolderId('default');
    }
    if (user) {
      deleteFolderFromCloud(id);
    }
  }, [selectedFolderId, user]);

  // Export current note
  const exportCurrentNote = useCallback((formatType: 'markdown' | 'txt' | 'html', specificNote?: Note) => {
    const targetNote = specificNote || activeNote;
    if (!targetNote) return;

    let contentToExport = targetNote.content;
    const filename = `${targetNote.title || 'Untitled'}.${
      formatType === 'markdown' ? 'md' : formatType
    }`;
    let mimeType = 'text/plain';

    if (formatType === 'txt') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = targetNote.content;
      contentToExport = tempDiv.textContent || tempDiv.innerText || '';
    } else if (formatType === 'markdown') {
      contentToExport = targetNote.content
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
      contentToExport = `<!DOCTYPE html><html><head><title>${targetNote.title}</title><meta charset="utf-8"></head><body>${targetNote.content}</body></html>`;
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
  }, [activeNote]);

  // Auto-exit selection mode if active folder changes
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedFolderId]);

  // Multi-selection actions
  const enterSelectionMode = useCallback((initialNoteId?: string) => {
    triggerHaptic();
    setIsSelectionMode(true);
    setSelectedNoteIds(initialNoteId ? [initialNoteId] : []);
  }, []);

  const exitSelectionMode = useCallback(() => {
    triggerHaptic();
    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, []);

  const toggleSelectNote = useCallback((noteId: string) => {
    triggerHaptic();
    setSelectedNoteIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  }, []);

  const selectAllNotes = useCallback(() => {
    triggerHaptic();
    setSelectedNoteIds(filteredNotes.map(n => n.id));
  }, [filteredNotes]);

  const deselectAllNotes = useCallback(() => {
    triggerHaptic();
    setSelectedNoteIds([]);
  }, []);

  const deleteSelectedNotes = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    triggerHaptic();
    const idsToDelete = new Set(selectedNoteIds);

    setNotes(prev =>
      prev
        .map(note => {
          if (idsToDelete.has(note.id)) {
            if (note.isTrash) {
              if (user) deleteNoteFromCloud(note.id);
              return null as unknown as Note;
            } else {
              const trashed: Note = { ...note, isTrash: true, isPinned: false };
              if (user) upsertNoteToCloud(trashed, user.id, encryptionKeyRef.current);
              return trashed;
            }
          }
          return note;
        })
        .filter(Boolean)
    );

    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, user]);

  const restoreSelectedNotes = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    triggerHaptic();
    const idsToRestore = new Set(selectedNoteIds);

    setNotes(prev =>
      prev.map(note => {
        if (idsToRestore.has(note.id)) {
          const restored: Note = { ...note, isTrash: false };
          if (user) upsertNoteToCloud(restored, user.id, encryptionKeyRef.current);
          return restored;
        }
        return note;
      })
    );

    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, user]);

  const togglePinSelectedNotes = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    triggerHaptic();
    const idsToToggle = new Set(selectedNoteIds);
    const selectedNotes = notes.filter(n => idsToToggle.has(n.id));
    const allPinned = selectedNotes.every(n => n.isPinned);
    const targetPinned = !allPinned;

    setNotes(prev =>
      prev.map(note => {
        if (idsToToggle.has(note.id)) {
          const updated: Note = { ...note, isPinned: targetPinned };
          if (user) upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          return updated;
        }
        return note;
      })
    );

    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, notes, user]);

  const moveSelectedNotesToFolder = useCallback((folderId: string) => {
    if (selectedNoteIds.length === 0) return;
    triggerHaptic();
    const idsToMove = new Set(selectedNoteIds);

    setNotes(prev =>
      prev.map(note => {
        if (idsToMove.has(note.id)) {
          const updated: Note = { ...note, folderId };
          if (user) upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          return updated;
        }
        return note;
      })
    );

    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, user]);

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
        mobileView,
        theme,
        filteredNotes,
        pinnedNotes,
        unpinnedNotes,
        currentFolder,
        isFolderPickerOpen,
        setIsFolderPickerOpen,
        isSelectionMode,
        selectedNoteIds,
        enterSelectionMode,
        exitSelectionMode,
        toggleSelectNote,
        selectAllNotes,
        deselectAllNotes,
        deleteSelectedNotes,
        togglePinSelectedNotes,
        moveSelectedNotesToFolder,
        restoreSelectedNotes,
        setActiveNoteId: (id) => {
          setActiveNoteId(id);
          if (id) setMobileView('editor');
        },
        setSelectedFolderId,
        setSearchQuery,
        setViewMode,
        setMobileView,
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
        renameFolder,
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
