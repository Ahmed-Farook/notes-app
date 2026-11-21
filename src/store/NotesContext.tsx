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
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  loadStoredNotes,
  saveStoredNotes,
  loadStoredFolders,
  saveStoredFolders,
  SYSTEM_FOLDERS,
  INITIAL_NOTES,
  isChecklistNote,
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
  batchUpsertNotesToCloud,
  batchUpsertFoldersToCloud,
  mergeNotes,
  mergeFolders,
  dbToNote,
  dbToFolder,
  DbNote,
  DbFolder,
} from '../utils/supabaseSync';
import {
  exportSingleNote,
  exportNotesAsZip,
  parseImportedFiles,
} from '../utils/noteExportImport';
import { promptBiometricAuth } from '../utils/biometrics';
import {
  syncNoteToAndroidWidget,
  syncPendingWidgetToggles,
  getWidgetPinnedNoteId,
  setWidgetPinnedNoteId,
} from '../utils/widgetSync';
import {
  getSharePayloadFromUrl,
  getShareSlugFromUrl,
  fetchSharedNoteFromSupabase,
  parseSharedPayload,
  cleanShareUrl,
} from '../utils/shareUtils';

export type PendingTrashDelete =
  | { type: 'single'; id: string; title?: string }
  | { type: 'bulk'; ids: string[] }
  | null;

const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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
  exportSelectedNotes: (formatType?: 'txt' | 'markdown' | 'html' | 'pdf') => Promise<void>;

  // Recycle Bin Confirmation Modal State
  pendingTrashDelete: PendingTrashDelete;
  confirmPendingTrashDelete: () => void;
  cancelPendingTrashDelete: () => void;

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
  deleteFolders: (ids: string[]) => void;
  exportCurrentNote: (formatType: 'markdown' | 'txt' | 'html' | 'pdf', noteToExport?: Note) => Promise<void> | void;
  importNotes: (files: FileList | File[]) => Promise<number>;

  // Note Password Protection & Locking
  unlockedNoteIds: Set<string>;
  unlockNote: (noteId: string, password: string) => Promise<boolean>;
  unlockNoteWithBiometrics: (noteId: string) => Promise<boolean>;
  lockNoteWithPassword: (noteId: string, password: string, hint?: string) => Promise<void>;
  removeNotePassword: (noteId: string, password: string) => Promise<boolean>;
  relockNote: (noteId: string) => void;

  // Android Widget Pinning
  widgetPinnedNoteId: string | null;
  toggleWidgetPinnedNote: (noteId: string) => void;

  // Shared Note Toast
  importedSharedToast: string | null;
  dismissImportedSharedToast: () => void;

  // Shared Note In-App Preview
  sharedPreviewNote: Note | null;
  saveSharedPreviewToNotes: () => void;
  dismissSharedPreview: () => void;

  // Cloud Synchronization
  syncWithCloud: (showIndicator?: boolean, force?: boolean) => Promise<void>;
}

export async function hashNotePassword(password: string, salt: string = ''): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt ? `texo_salt:${salt}:${password}` : password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>(() => loadStoredNotes());
  const [folders, setFolders] = useState<Folder[]>(() => loadStoredFolders());
  const [selectedFolderId, setSelectedFolderIdState] = useState<string>('default');
  const [activeNoteId, setActiveNoteIdState] = useState<string | null>(null);
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
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Set<string>>(new Set());
  const [pendingTrashDelete, setPendingTrashDelete] = useState<PendingTrashDelete>(null);
  const [widgetPinnedNoteId, setWidgetPinnedNoteIdState] = useState<string | null>(() => getWidgetPinnedNoteId());
  const [importedSharedToast, setImportedSharedToast] = useState<string | null>(null);
  const [sharedPreviewNote, setSharedPreviewNote] = useState<Note | null>(null);
  const sharedPayloadProcessedRef = useRef(false);
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
  encryptionKeyRef.current = encryptionKey;

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const cloudSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks newly created notes that haven't received any edits yet so exiting discards them cleanly
  const uneditedNewNoteIdsRef = useRef<Set<string>>(new Set());
  // Tracks note IDs confirmed present in the cloud to cleanly detect deletions across devices
  const syncedNoteIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem('apple_notes_synced_ids_v1');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set<string>(arr);
        }
      } catch (_) {}
      return new Set<string>();
    })()
  );

  const setActiveNoteId = useCallback((nextId: string | null) => {
    setActiveNoteIdState((prevId) => {
      if (prevId && prevId !== nextId) {
        if (uneditedNewNoteIdsRef.current.has(prevId)) {
          uneditedNewNoteIdsRef.current.delete(prevId);
          setNotes((curr) => curr.filter((n) => n.id !== prevId));
        } else if (cloudSaveTimers.current[prevId]) {
          clearTimeout(cloudSaveTimers.current[prevId]);
          delete cloudSaveTimers.current[prevId];
          const target = notesRef.current.find((n) => n.id === prevId);
          if (target && user && encryptionKeyRef.current) {
            upsertNoteToCloud(target, user.id, encryptionKeyRef.current);
          }
        }
      }
      return nextId;
    });
  }, [user]);

  const setSelectedFolderId = useCallback((folderId: string) => {
    setActiveNoteIdState((prevId) => {
      if (prevId) {
        if (uneditedNewNoteIdsRef.current.has(prevId)) {
          uneditedNewNoteIdsRef.current.delete(prevId);
          setNotes((curr) => curr.filter((n) => n.id !== prevId));
          return null;
        } else if (cloudSaveTimers.current[prevId]) {
          clearTimeout(cloudSaveTimers.current[prevId]);
          delete cloudSaveTimers.current[prevId];
          const target = notesRef.current.find((n) => n.id === prevId);
          if (target && user && encryptionKeyRef.current) {
            upsertNoteToCloud(target, user.id, encryptionKeyRef.current);
          }
        }
      }
      return prevId;
    });
    setSelectedFolderIdState(folderId);
  }, [user]);

  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef<number>(0);

  // Fast, reliable bidirectional cloud synchronization
  const syncWithCloud = useCallback(async (showIndicator = false, force = false) => {
    if (!user || !encryptionKeyRef.current || isSyncingRef.current) return;
    // Debounce rapid repeated sync calls unless explicitly forced
    if (!force && Date.now() - lastSyncTimeRef.current < 2000) return;

    isSyncingRef.current = true;
    if (showIndicator) setSyncStatus('syncing');

    // Safety guarantee: never get stuck in syncing mode
    const safetyTimer = setTimeout(() => {
      setSyncStatus('synced');
    }, 3500);

    try {
      // Pass existing local notes & folders so unchanged items skip expensive Web Crypto decryptions
      const [remoteNotes, remoteFolders] = await Promise.all([
        fetchUserNotes(encryptionKeyRef.current, notesRef.current),
        fetchUserFolders(encryptionKeyRef.current, foldersRef.current),
      ]);

      let effectiveRemoteNotes = remoteNotes;
      const isLegacySampleSet =
        remoteNotes.length === 3 &&
        remoteNotes.some((n) => n.id === 'note-roadmap') &&
        remoteNotes.some((n) => n.id === 'note-weekend-ideas');

      if (isLegacySampleSet) {
        await Promise.all([
          deleteNoteFromCloud('note-roadmap'),
          deleteNoteFromCloud('note-weekend-ideas'),
        ]);
        effectiveRemoteNotes = INITIAL_NOTES;
      }

      const syncedIds = syncedNoteIdsRef.current;
      const { merged: mergedNotes, toUpload: notesToUpload } = mergeNotes(
        notesRef.current,
        effectiveRemoteNotes,
        syncedIds.size > 0 ? syncedIds : undefined
      );

      // Track all current remote notes in synced IDs
      for (const r of effectiveRemoteNotes) {
        syncedIds.add(r.id);
      }
      try {
        localStorage.setItem('apple_notes_synced_ids_v1', JSON.stringify(Array.from(syncedIds)));
      } catch (_) {}
      const { merged: mergedFolders, toUpload: foldersToUpload } = mergeFolders(
        foldersRef.current,
        remoteFolders
      );

      clearTimeout(safetyTimer);
      setNotes(mergedNotes);
      setFolders(mergedFolders);
      setSyncStatus('synced');
      lastSyncTimeRef.current = Date.now();

      // Batch upload in single atomic HTTP requests to minimize network roundtrips
      if (notesToUpload.length > 0 || foldersToUpload.length > 0) {
        await Promise.all([
          batchUpsertNotesToCloud(notesToUpload, user.id, encryptionKeyRef.current),
          batchUpsertFoldersToCloud(foldersToUpload, user.id, encryptionKeyRef.current),
        ]);
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      console.warn('Sync error:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('synced');
      }
    } finally {
      clearTimeout(safetyTimer);
      isSyncingRef.current = false;
    }
  }, [user, setSyncStatus]);

  // Auto-prune any unnamed or system folders from custom folders on startup
  useEffect(() => {
    setFolders(prev => {
      const sanitized = prev.filter(
        f => Boolean(f && f.id && f.name && f.name.trim() && f.id !== 'default' && f.id !== 'checklists' && f.id !== 'trash')
      );
      if (sanitized.length !== prev.length) {
        saveStoredFolders(sanitized);
        return sanitized;
      }
      return prev;
    });
  }, []);

  // Sync with Supabase on user sign-in & listen to Realtime changes
  useEffect(() => {
    if (!user || !encryptionKey) return;

    let isMounted = true;
    syncWithCloud(true, true);

    // 2. Realtime WebSocket subscription
    const channel = supabase
      .channel('apple_notes_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, async (payload) => {
        if (!isMounted) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          try {
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
            setSyncStatus('synced');
          } catch (e) {
            console.error('Error handling realtime note update:', e);
          }
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
          try {
            const remoteFolder = await dbToFolder(payload.new as DbFolder, encryptionKeyRef.current);
            if (!remoteFolder || !remoteFolder.name || !remoteFolder.name.trim() || remoteFolder.id === 'default' || remoteFolder.id === 'checklists' || remoteFolder.id === 'trash') {
              return;
            }
            setFolders(prev => {
              const idx = prev.findIndex(f => f.id === remoteFolder.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = remoteFolder;
                return copy;
              }
              return [...prev, remoteFolder];
            });
            setSyncStatus('synced');
          } catch (e) {
            console.error('Error handling realtime folder update:', e);
          }
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
  }, [user, encryptionKey, syncWithCloud]);

  // Capacitor Native App Resume & Lifecycle Listeners for Mobile Android/iOS
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appStateHandle: any = null;
    let resumeHandle: any = null;

    try {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          syncWithCloud(true, true);
        }
      }).then(handle => { appStateHandle = handle; });

      CapApp.addListener('resume', () => {
        syncWithCloud(true, true);
      }).then(handle => { resumeHandle = handle; });
    } catch (e) {
      console.warn('Failed to attach Capacitor app lifecycle listeners:', e);
    }

    return () => {
      if (appStateHandle?.remove) appStateHandle.remove();
      if (resumeHandle?.remove) resumeHandle.remove();
    };
  }, [syncWithCloud]);

  // Fast background auto-sync whenever the window regains focus, becomes visible, or network comes online
  useEffect(() => {
    if (!user || !encryptionKey) return;

    const handleWakeupSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithCloud(true, true);
      }
    };

    window.addEventListener('focus', handleWakeupSync);
    window.addEventListener('online', handleWakeupSync);
    document.addEventListener('visibilitychange', handleWakeupSync);

    // Periodic heartbeat sync every 20 seconds when app is visible
    const heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithCloud(false, false);
      }
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleWakeupSync);
      window.removeEventListener('online', handleWakeupSync);
      document.removeEventListener('visibilitychange', handleWakeupSync);
      clearInterval(heartbeatTimer);
    };
  }, [user, encryptionKey, syncWithCloud]);

  // Flush pending cloud saves when closing or navigating away from web app
  useEffect(() => {
    const flushPendingSaves = () => {
      const activeTimers = cloudSaveTimers.current;
      const ids = Object.keys(activeTimers);
      if (ids.length > 0 && user && encryptionKeyRef.current) {
        for (const id of ids) {
          clearTimeout(activeTimers[id]);
          delete activeTimers[id];
          const noteToSave = notesRef.current.find(n => n.id === id);
          if (noteToSave) {
            upsertNoteToCloud(noteToSave, user.id, encryptionKeyRef.current).catch(console.warn);
          }
        }
      }
    };

    window.addEventListener('beforeunload', flushPendingSaves);
    window.addEventListener('pagehide', flushPendingSaves);

    return () => {
      window.removeEventListener('beforeunload', flushPendingSaves);
      window.removeEventListener('pagehide', flushPendingSaves);
    };
  }, [user]);

  // Apply dark mode class to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('apple_notes_theme', theme);
  }, [theme]);

  // Auto-purge notes in Recently Deleted older than 7 days
  useEffect(() => {
    const purgeExpiredTrash = () => {
      const now = Date.now();
      setNotes((prev) => {
        const expired = prev.filter(
          (n) => n.isTrash && now - (n.deletedAt ?? n.updatedAt) >= TRASH_RETENTION_MS
        );
        if (expired.length === 0) return prev;
        if (user) {
          expired.forEach((n) => deleteNoteFromCloud(n.id));
        }
        const expiredSet = new Set(expired.map((n) => n.id));
        return prev.filter((n) => !expiredSet.has(n.id));
      });
    };

    purgeExpiredTrash();
    const interval = setInterval(purgeExpiredTrash, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Snappy debounced persistence: never blocks typing or UI updates (and skips unedited drafts)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStoredNotes(notes.filter((n) => !uneditedNewNoteIdsRef.current.has(n.id)));
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
        saveStoredNotes(notes.filter((n) => !uneditedNewNoteIdsRef.current.has(n.id)));
      }
      if (user && encryptionKeyRef.current) {
        for (const noteId of Object.keys(cloudSaveTimers.current)) {
          clearTimeout(cloudSaveTimers.current[noteId]);
          delete cloudSaveTimers.current[noteId];
          const target = notesRef.current.find((n) => n.id === noteId);
          if (target) {
            upsertNoteToCloud(target, user.id, encryptionKeyRef.current);
          }
        }
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('blur', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('blur', handleFlush);
    };
  }, [notes, user]);

  // Persist folders
  useEffect(() => {
    saveStoredFolders(folders);
  }, [folders]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleSidebar = useCallback(() => {
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
        const isChecklist = isChecklistNote(note);

        if (selectedFolderId === 'default') {
          // Main Notes section contains default notes and legacy quick/all (excluding checklists)
          if (isChecklist) return false;
          if (noteFolder !== 'default' && noteFolder !== 'quick' && noteFolder !== 'all') {
            return false;
          }
        } else if (selectedFolderId === 'checklists') {
          // Checklists section shows checklists in the checklists folder
          if (!isChecklist) return false;
          if (noteFolder !== 'checklists') return false;
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

  // Active note instance (prioritizes temporary in-app shared preview if active)
  const activeNote = useMemo(() => {
    if (sharedPreviewNote && activeNoteId === sharedPreviewNote.id) {
      return sharedPreviewNote;
    }
    if (!activeNoteId) return null;
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId, sharedPreviewNote]);

  // Only update active note if an active note is no longer in the list (e.g. moved or deleted)
  useEffect(() => {
    if (activeNoteId) {
      if (sharedPreviewNote && activeNoteId === sharedPreviewNote.id) {
        return;
      }
      const activeStillInList = filteredNotes.some(n => n.id === activeNoteId);
      if (!activeStillInList) {
        setActiveNoteId(null);
      }
    }
  }, [filteredNotes, activeNoteId, sharedPreviewNote]);

  // Create new note (kept as local draft until user makes first edit or drawing)
  const createNote = useCallback((folderId?: string): Note => {
    triggerHaptic();
    const isChecklistTarget = folderId === 'checklists' || (!folderId && selectedFolderId === 'checklists');
    const targetFolder =
      folderId ||
      (selectedFolderId === 'trash' || selectedFolderId === 'all' || selectedFolderId === 'pinned'
        ? (isChecklistTarget ? 'checklists' : 'default')
        : selectedFolderId);

    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: isChecklistTarget ? 'To-Do List' : 'New Note',
      content: isChecklistTarget
        ? '<h1>To-Do List</h1><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>'
        : '<h1>New Note</h1><p></p>',
      plainTextPreview: isChecklistTarget ? '0 tasks completed' : 'No additional text',
      folderId: targetFolder,
      isChecklist: isChecklistTarget ? true : false,
      isPinned: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    uneditedNewNoteIdsRef.current.add(newNote.id);
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setMobileView('editor');

    if (isChecklistTarget) {
      setTimeout(() => {
        syncNoteToAndroidWidget([newNote, ...notesRef.current], newNote.id);
      }, 60);
    }

    return newNote;
  }, [selectedFolderId, setActiveNoteId]);

  // Update note
  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          const hasContentChanged =
            (updates.content !== undefined && updates.content !== note.content) ||
            (updates.title !== undefined && updates.title !== note.title) ||
            (updates.plainTextPreview !== undefined && updates.plainTextPreview !== note.plainTextPreview) ||
            (updates.drawingStrokes !== undefined && updates.drawingStrokes !== note.drawingStrokes) ||
            (updates.isLocked !== undefined && updates.isLocked !== note.isLocked) ||
            (updates.passwordHash !== undefined && updates.passwordHash !== note.passwordHash) ||
            (updates.passwordHint !== undefined && updates.passwordHint !== note.passwordHint) ||
            (updates.isPinned !== undefined && updates.isPinned !== note.isPinned) ||
            (updates.isTrash !== undefined && updates.isTrash !== note.isTrash) ||
            (updates.folderId !== undefined && updates.folderId !== note.folderId);

          if (hasContentChanged) {
            uneditedNewNoteIdsRef.current.delete(id);
          }

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
            cloudSaveTimers.current[id] = setTimeout(async () => {
              try {
                setSyncStatus('syncing');
                await upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
                setSyncStatus('synced');
              } catch (err) {
                console.warn('Failed cloud upsert:', err);
                setSyncStatus('error');
              } finally {
                delete cloudSaveTimers.current[id];
              }
            }, 300);
          }

          return updated;
        }
        return note;
      })
    );
  }, [user]);

  // Listen to native Electron bridge actions and Android widget events if available
  useEffect(() => {
    const electronAPI = (window as unknown as { electronAPI?: { sendNewNote: (cb: () => void) => void } })?.electronAPI;
    if (electronAPI?.sendNewNote) {
      electronAPI.sendNewNote(() => {
        createNote();
      });
    }

    const handleWidgetNewNote = () => {
      createNote();
    };
    const handleWidgetOpenNote = (e: any) => {
      const targetId = e.detail?.noteId;
      if (targetId) {
        setActiveNoteId(targetId);
        setMobileView('editor');
      }
    };
    const handleWidgetAddChecklistItem = (e: any) => {
      const targetId = e.detail?.noteId;
      if (targetId) {
        setActiveNoteId(targetId);
        setMobileView('editor');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('editor:quick-add-checklist'));
        }, 300);
      } else {
        createNote();
      }
    };

    window.addEventListener('action:new-note', handleWidgetNewNote);
    window.addEventListener('action:open-note', handleWidgetOpenNote);
    window.addEventListener('action:add-checklist-item', handleWidgetAddChecklistItem);
    return () => {
      window.removeEventListener('action:new-note', handleWidgetNewNote);
      window.removeEventListener('action:open-note', handleWidgetOpenNote);
      window.removeEventListener('action:add-checklist-item', handleWidgetAddChecklistItem);
    };
  }, [createNote, setActiveNoteId]);

  const dismissImportedSharedToast = useCallback(() => {
    setImportedSharedToast(null);
  }, []);

  const toggleWidgetPinnedNote = useCallback((noteId: string) => {
    triggerHaptic();
    setWidgetPinnedNoteIdState((prev) => {
      const next = prev === noteId ? null : noteId;
      setWidgetPinnedNoteId(next);
      setTimeout(() => {
        syncNoteToAndroidWidget(notesRef.current, next || activeNoteId);
      }, 50);
      return next;
    });
  }, [activeNoteId]);

  // Decode and load shared note into in-app preview mode (WITHOUT auto-saving to private library)
  useEffect(() => {
    if (sharedPayloadProcessedRef.current) return;

    const setupPreview = (sharedData: { title?: string; content?: string; strokes?: string }) => {
      let plainSnippet = '';
      if (typeof document !== 'undefined') {
        try {
          const tmp = document.createElement('div');
          tmp.innerHTML = sharedData.content || '';
          plainSnippet = (tmp.textContent || tmp.innerText || '').trim().substring(0, 150);
        } catch (_) {}
      }
      if (!plainSnippet && sharedData.strokes) {
        plainSnippet = '[Handwritten Drawing / Annotation]';
      }

      const previewNote: Note = {
        id: 'shared-preview-note',
        title: sharedData.title || 'Shared Note',
        content: sharedData.content || '<p></p>',
        drawingStrokes: sharedData.strokes || undefined,
        plainTextPreview: plainSnippet || 'Shared note preview',
        folderId: 'default',
        isChecklist: Boolean(
          sharedData.title === 'To-Do List' &&
          sharedData.content?.startsWith('<h1>To-Do List</h1><ul data-type="taskList">')
        ),
        isPinned: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Set as preview only: DO NOT mutate private notes or write to storage
      setSharedPreviewNote(previewNote);
      setActiveNoteId('shared-preview-note');
      setMobileView('editor');
    };

    // 1. Check for short Supabase slug (e.g. /s/<slug> or ?s=<slug>)
    const slug = getShareSlugFromUrl();
    if (slug) {
      sharedPayloadProcessedRef.current = true;
      fetchSharedNoteFromSupabase(slug).then((sharedData) => {
        if (sharedData) {
          setupPreview(sharedData);
        }
      });
      return;
    }

    // 2. Check for compressed or legacy payload in URL hash/query
    const payloadStr = getSharePayloadFromUrl();
    if (payloadStr) {
      sharedPayloadProcessedRef.current = true;
      const sharedData = parseSharedPayload(payloadStr);
      if (sharedData) {
        setupPreview(sharedData);
      }
    }
  }, [setActiveNoteId]);

  // Saves the previewed shared note into the user's permanent personal notes collection
  const saveSharedPreviewToNotes = useCallback(() => {
    if (!sharedPreviewNote) return;
    triggerHaptic();

    const permanentNote: Note = {
      ...sharedPreviewNote,
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setNotes((prev) => [permanentNote, ...prev]);
    setSharedPreviewNote(null);
    setActiveNoteId(permanentNote.id);
    cleanShareUrl();
    setImportedSharedToast(`"${permanentNote.title}" saved to your notes`);
  }, [sharedPreviewNote, setActiveNoteId]);

  // Dismisses the shared note preview without touching the user's private library
  const dismissSharedPreview = useCallback(() => {
    triggerHaptic();
    setSharedPreviewNote(null);
    cleanShareUrl();
    setActiveNoteId(null);
    setMobileView('list');
  }, [setActiveNoteId]);

  // Keep Android Home Screen Widget in sync with the user's latest checklist / note
  useEffect(() => {
    const timer = setTimeout(() => {
      syncNoteToAndroidWidget(notes, activeNoteId);
    }, 350);
    return () => clearTimeout(timer);
  }, [notes, activeNoteId]);

  // Apply any checklist items toggled on the Android widget while app was backgrounded
  useEffect(() => {
    syncPendingWidgetToggles(notesRef.current, updateNote);

    const handleFocusOrResume = () => {
      syncPendingWidgetToggles(notesRef.current, updateNote);
    };

    window.addEventListener('focus', handleFocusOrResume);
    window.addEventListener('visibilitychange', handleFocusOrResume);
    return () => {
      window.removeEventListener('focus', handleFocusOrResume);
      window.removeEventListener('visibilitychange', handleFocusOrResume);
    };
  }, [updateNote]);

  // Move note to Recycle Bin (or open confirmation modal if already in Recycle Bin)
  const deleteNote = useCallback((id: string) => {
    const target = notesRef.current.find(n => n.id === id);
    if (!target) return;

    // If it's an untouched new draft, simply discard it silently
    if (uneditedNewNoteIdsRef.current.has(id)) {
      uneditedNewNoteIdsRef.current.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (activeNoteId === id) {
        setActiveNoteIdState(null);
        setMobileView('list');
      }
      return;
    }

    triggerHaptic();
    if (target.isTrash) {
      setPendingTrashDelete({ type: 'single', id: target.id, title: target.title });
      return;
    }

    const trashed: Note = {
      ...target,
      isTrash: true,
      isPinned: false,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes(prev => prev.map(n => (n.id === id ? trashed : n)));
    if (user) {
      upsertNoteToCloud(trashed, user.id, encryptionKeyRef.current);
    }

    if (activeNoteId === id) {
      const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobileViewport) {
        setActiveNoteIdState(null);
        setMobileView('list');
      } else {
        const remaining = filteredNotes.filter(n => n.id !== id);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
        if (remaining.length === 0) {
          setMobileView('list');
        }
      }
    }
  }, [activeNoteId, filteredNotes, user, setActiveNoteId]);

  const permanentlyDeleteNote = useCallback((id: string) => {
    const target = notesRef.current.find(n => n.id === id);
    triggerHaptic();
    setPendingTrashDelete({ type: 'single', id, title: target?.title });
  }, []);

  const restoreNote = useCallback((id: string) => {
    triggerHaptic();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          const restored: Note = {
            ...n,
            isTrash: false,
            deletedAt: undefined,
            updatedAt: Date.now(),
          };
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
          const updated: Note = { ...n, isPinned: !n.isPinned, updatedAt: Date.now() };
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
          const isChecklist = isChecklistNote(n);
          const updated: Note = {
            ...n,
            folderId,
            isChecklist: isChecklist ? true : false,
            updatedAt: Date.now(),
          };
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
      prev.map(n => {
        if (n.folderId === id) {
          const updated = { ...n, folderId: 'default', updatedAt: Date.now() };
          if (user) upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          return updated;
        }
        return n;
      })
    );
    if (selectedFolderId === id) {
      setSelectedFolderId('default');
    }
    if (user) {
      deleteFolderFromCloud(id);
    }
  }, [selectedFolderId, user]);

  const deleteFolders = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    triggerHaptic();
    const idSet = new Set(ids);
    setFolders(prev => prev.filter(f => !idSet.has(f.id)));
    setNotes(prev =>
      prev.map(n => {
        if (n.folderId && idSet.has(n.folderId)) {
          const updated = { ...n, folderId: 'default', updatedAt: Date.now() };
          if (user) upsertNoteToCloud(updated, user.id, encryptionKeyRef.current);
          return updated;
        }
        return n;
      })
    );
    if (selectedFolderId && idSet.has(selectedFolderId)) {
      setSelectedFolderId('default');
    }
    if (user) {
      ids.forEach(id => deleteFolderFromCloud(id));
    }
  }, [selectedFolderId, user]);

  // Export current note (preserves line breaks cleanly & includes drawings in PDF)
  const exportCurrentNote = useCallback(
    async (formatType: 'markdown' | 'txt' | 'html' | 'pdf', specificNote?: Note) => {
      const targetNote = specificNote || activeNote;
      if (!targetNote) return;
      await exportSingleNote(targetNote, formatType);
    },
    [activeNote]
  );

  // Bulk export selected notes as a ZIP archive
  const exportSelectedNotes = useCallback(
    async (formatType: 'txt' | 'markdown' | 'html' | 'pdf' = 'txt') => {
      if (selectedNoteIds.length === 0) return;
      const idSet = new Set(selectedNoteIds);
      const selected = notesRef.current.filter((n) => idSet.has(n.id));
      await exportNotesAsZip(selected, formatType);
      setIsSelectionMode(false);
      setSelectedNoteIds([]);
    },
    [selectedNoteIds]
  );

  // Import text / markdown / html / zip files into notes
  const importNotes = useCallback(
    async (files: FileList | File[]): Promise<number> => {
      const parsed = await parseImportedFiles(files);
      if (parsed.length === 0) return 0;

      const targetFolder =
        selectedFolderId === 'trash' ||
        selectedFolderId === 'all' ||
        selectedFolderId === 'pinned'
          ? 'default'
          : selectedFolderId;

      const now = Date.now();
      const created: Note[] = parsed.map((item, idx) => ({
        id: `note-${now + idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title,
        content: item.content,
        plainTextPreview: item.plainTextPreview,
        folderId: targetFolder,
        isPinned: false,
        isTrash: false,
        createdAt: now + idx,
        updatedAt: now + idx,
      }));

      setNotes((prev) => [...created, ...prev]);
      if (created.length > 0) {
        setActiveNoteId(created[0].id);
        setMobileView('editor');
      }

      if (user) {
        created.forEach((note) => {
          upsertNoteToCloud(note, user.id, encryptionKeyRef.current);
        });
      }

      return created.length;
    },
    [selectedFolderId, user, setActiveNoteId]
  );

  // Note Password Protection & Unlocking Callbacks
  const unlockNote = useCallback(async (noteId: string, password: string): Promise<boolean> => {
    const note = notesRef.current.find((n) => n.id === noteId);
    if (!note || !note.passwordHash) return false;
    const saltedHash = await hashNotePassword(password, noteId);
    const legacyHash = await hashNotePassword(password);
    if (note.passwordHash === saltedHash || note.passwordHash === legacyHash) {
      if (note.passwordHash === legacyHash) {
        updateNote(noteId, { passwordHash: saltedHash });
      }
      setUnlockedNoteIds((prev) => new Set(prev).add(noteId));
      triggerHaptic();
      return true;
    }
    return false;
  }, [updateNote]);

  const unlockNoteWithBiometrics = useCallback(async (noteId: string): Promise<boolean> => {
    const note = notesRef.current.find((n) => n.id === noteId);
    if (!note || !note.isLocked) return false;
    const res = await promptBiometricAuth(`Unlock "${note.title || 'Note'}"`);
    if (res && res.success === true) {
      setUnlockedNoteIds((prev) => new Set(prev).add(noteId));
      triggerHaptic();
      return true;
    }
    return false;
  }, []);

  const lockNoteWithPassword = useCallback(
    async (noteId: string, password: string, hint?: string): Promise<void> => {
      const hash = await hashNotePassword(password, noteId);
      const now = Date.now();
      updateNote(noteId, {
        isLocked: true,
        passwordHash: hash,
        passwordHint: hint ? hint.trim() : undefined,
        updatedAt: now,
      });
      setUnlockedNoteIds((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });

      // Instantly upload lock metadata to cloud so cloud sync never strips the lock
      if (user && encryptionKeyRef.current) {
        const target = notesRef.current.find((n) => n.id === noteId);
        if (target) {
          upsertNoteToCloud(
            {
              ...target,
              isLocked: true,
              passwordHash: hash,
              passwordHint: hint ? hint.trim() : undefined,
              updatedAt: now,
            },
            user.id,
            encryptionKeyRef.current
          ).catch((err) => console.warn('Failed cloud lock upsert:', err));
        }
      }

      triggerHaptic();
    },
    [updateNote, user]
  );

  const removeNotePassword = useCallback(
    async (noteId: string, password: string): Promise<boolean> => {
      const note = notesRef.current.find((n) => n.id === noteId);
      if (!note || !note.passwordHash) return false;
      const saltedHash = await hashNotePassword(password, noteId);
      const legacyHash = await hashNotePassword(password);
      if (note.passwordHash === saltedHash || note.passwordHash === legacyHash) {
        const now = Date.now();
        updateNote(noteId, {
          isLocked: false,
          passwordHash: undefined,
          passwordHint: undefined,
          updatedAt: now,
        });
        setUnlockedNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });

        if (user && encryptionKeyRef.current) {
          upsertNoteToCloud(
            {
              ...note,
              isLocked: false,
              passwordHash: undefined,
              passwordHint: undefined,
              updatedAt: now,
            },
            user.id,
            encryptionKeyRef.current
          ).catch((err) => console.warn('Failed cloud remove lock upsert:', err));
        }

        triggerHaptic();
        return true;
      }
      return false;
    },
    [updateNote, user]
  );

  const relockNote = useCallback((noteId: string): void => {
    setUnlockedNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
    triggerHaptic();
  }, []);

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
    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, []);

  const toggleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  }, []);

  const selectAllNotes = useCallback(() => {
    setSelectedNoteIds(filteredNotes.map(n => n.id));
  }, [filteredNotes]);

  const deselectAllNotes = useCallback(() => {
    setSelectedNoteIds([]);
  }, []);

  const deleteSelectedNotes = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    const idsToDelete = new Set(selectedNoteIds);
    const targetNotes = notesRef.current.filter(n => idsToDelete.has(n.id));
    const hasTrashedNotes = targetNotes.some(n => n.isTrash);

    // Require explicit "Are you sure?" confirmation if permanently deleting from Recycle Bin
    if (hasTrashedNotes) {
      setPendingTrashDelete({
        type: 'bulk',
        ids: targetNotes.filter(n => n.isTrash).map(n => n.id),
      });
      return;
    }

    triggerHaptic();
    const deletedAt = Date.now();
    setNotes(prev =>
      prev.map(note => {
        if (idsToDelete.has(note.id)) {
          const trashed: Note = { ...note, isTrash: true, isPinned: false, deletedAt, updatedAt: Date.now() };
          if (user) upsertNoteToCloud(trashed, user.id, encryptionKeyRef.current);
          return trashed;
        }
        return note;
      })
    );

    setIsSelectionMode(false);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, user]);

  const confirmPendingTrashDelete = useCallback(() => {
    if (!pendingTrashDelete) return;
    triggerHaptic();

    const idsToRemove = new Set(
      pendingTrashDelete.type === 'single' ? [pendingTrashDelete.id] : pendingTrashDelete.ids
    );

    setNotes(prev => prev.filter(n => !idsToRemove.has(n.id)));
    if (user) {
      idsToRemove.forEach(id => deleteNoteFromCloud(id));
      for (const id of idsToRemove) {
        syncedNoteIdsRef.current.delete(id);
      }
      try {
        localStorage.setItem('apple_notes_synced_ids_v1', JSON.stringify(Array.from(syncedNoteIdsRef.current)));
      } catch (_) {}
    }

    if (activeNoteId && idsToRemove.has(activeNoteId)) {
      const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobileViewport) {
        setActiveNoteIdState(null);
        setMobileView('list');
      } else {
        const remaining = filteredNotes.filter(n => !idsToRemove.has(n.id));
        setActiveNoteIdState(remaining.length > 0 ? remaining[0].id : null);
        if (remaining.length === 0) {
          setMobileView('list');
        }
      }
    }

    if (pendingTrashDelete.type === 'bulk') {
      setIsSelectionMode(false);
      setSelectedNoteIds([]);
    }

    setPendingTrashDelete(null);
  }, [pendingTrashDelete, user, activeNoteId, filteredNotes]);

  const cancelPendingTrashDelete = useCallback(() => {
    setPendingTrashDelete(null);
  }, []);

  const restoreSelectedNotes = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    triggerHaptic();
    const idsToRestore = new Set(selectedNoteIds);

    setNotes(prev =>
      prev.map(note => {
        if (idsToRestore.has(note.id)) {
          const restored: Note = {
            ...note,
            isTrash: false,
            deletedAt: undefined,
            updatedAt: Date.now(),
          };
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
          const updated: Note = { ...note, isPinned: targetPinned, updatedAt: Date.now() };
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
          const isChecklist = isChecklistNote(note);
          const updated: Note = {
            ...note,
            folderId,
            isChecklist: isChecklist ? true : false,
            updatedAt: Date.now(),
          };
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
        exportSelectedNotes,
        pendingTrashDelete,
        confirmPendingTrashDelete,
        cancelPendingTrashDelete,
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
        deleteFolders,
        exportCurrentNote,
        importNotes,
        unlockedNoteIds,
        unlockNote,
        unlockNoteWithBiometrics,
        lockNoteWithPassword,
        removeNotePassword,
        relockNote,
        widgetPinnedNoteId,
        toggleWidgetPinnedNote,
        importedSharedToast,
        dismissImportedSharedToast,
        sharedPreviewNote,
        saveSharedPreviewToNotes,
        dismissSharedPreview,
        syncWithCloud,
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
