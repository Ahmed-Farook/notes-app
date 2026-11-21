import { Note, Folder } from '../types/note';
import { supabase } from '../lib/supabase';
import { encryptText, decryptText } from './crypto';
import { isChecklistNote } from './storage';

export interface DbNote {
  id: string;
  title: string;
  content: string;
  plain_text_preview: string;
  folder_id: string;
  is_pinned: boolean;
  is_trash: boolean;
  created_at: number;
  updated_at: number;
  user_id?: string;
}

export interface DbFolder {
  id: string;
  name: string;
  icon?: string | null;
  is_system?: boolean;
  updated_at: number;
  user_id?: string;
}

/**
 * Encrypts and formats a Note for PostgreSQL storage.
 */
export async function noteToDb(note: Note, userId: string, key: CryptoKey | null): Promise<DbNote> {
  // Bundle handwritten drawing strokes, checklist state, trash deletion timestamp, and lock metadata securely with content
  const isChecklist = isChecklistNote(note);
  const needsBundle = Boolean(
    isChecklist ||
    note.drawingStrokes ||
    note.deletedAt ||
    note.isLocked ||
    note.passwordHash ||
    note.passwordHint
  );
  const rawContent = needsBundle
    ? JSON.stringify({
        html: note.content || '',
        ...(isChecklist ? { isChecklist: true } : {}),
        ...(note.drawingStrokes ? { strokes: note.drawingStrokes } : {}),
        ...(note.deletedAt ? { deletedAt: note.deletedAt } : {}),
        ...(note.isLocked ? { isLocked: note.isLocked } : {}),
        ...(note.passwordHash ? { passwordHash: note.passwordHash } : {}),
        ...(note.passwordHint ? { passwordHint: note.passwordHint } : {}),
      })
    : note.content || '';

  const [encryptedTitle, encryptedContent, encryptedPreview] = await Promise.all([
    encryptText(note.title || '', key),
    encryptText(rawContent, key),
    encryptText(note.plainTextPreview || '', key),
  ]);

  return {
    id: note.id,
    title: encryptedTitle,
    content: encryptedContent,
    plain_text_preview: encryptedPreview,
    folder_id: note.folderId || 'default',
    is_pinned: Boolean(note.isPinned),
    is_trash: Boolean(note.isTrash),
    created_at: note.createdAt || Date.now(),
    updated_at: note.updatedAt || Date.now(),
    user_id: userId,
  };
}

/**
 * Decrypts a DbNote retrieved from PostgreSQL.
 */
export async function dbToNote(db: DbNote, key: CryptoKey | null): Promise<Note> {
  const [decryptedTitle, decryptedContent, decryptedPreview] = await Promise.all([
    decryptText(db.title, key),
    decryptText(db.content, key),
    decryptText(db.plain_text_preview, key),
  ]);

  let title = decryptedTitle || '';
  let content = decryptedContent || '';
  let plainTextPreview = decryptedPreview || '';
  let drawingStrokes: string | undefined = undefined;
  let deletedAt: number | undefined = undefined;
  let isLocked: boolean | undefined = undefined;
  let passwordHash: string | undefined = undefined;
  let passwordHint: string | undefined = undefined;
  let isChecklist: boolean | undefined = db.folder_id === 'checklists' ? true : undefined;

  // Unpack bundled drawing strokes / checklist flag / deletedAt / lock metadata if present
  if (content && typeof content === 'string' && content.startsWith('{"html":')) {
    try {
      const parsed = JSON.parse(content);
      content = parsed.html || '';
      drawingStrokes = parsed.strokes;
      if (typeof parsed.isChecklist === 'boolean') {
        isChecklist = parsed.isChecklist;
      }
      if (typeof parsed.deletedAt === 'number') {
        deletedAt = parsed.deletedAt;
      }
      if (typeof parsed.isLocked === 'boolean') {
        isLocked = parsed.isLocked;
      }
      if (typeof parsed.passwordHash === 'string') {
        passwordHash = parsed.passwordHash;
      }
      if (typeof parsed.passwordHint === 'string') {
        passwordHint = parsed.passwordHint;
      }
    } catch (_) {}
  }

  // Fallback to structure detection if not explicitly set
  if (!isChecklist && (content.includes('data-type="taskList"') && !content.includes('<p>We\'re so glad you\'re here'))) {
    isChecklist = true;
  }

  return {
    id: db.id,
    title,
    content,
    drawingStrokes,
    plainTextPreview,
    folderId: db.folder_id || 'default',
    isChecklist,
    isPinned: Boolean(db.is_pinned),
    isTrash: Boolean(db.is_trash),
    deletedAt,
    isLocked,
    passwordHash,
    passwordHint,
    createdAt: Number(db.created_at) || Date.now(),
    updatedAt: Number(db.updated_at) || Date.now(),
  };
}

/**
 * Encrypts and formats a Folder for PostgreSQL storage.
 */
export async function folderToDb(folder: Folder, userId: string, key: CryptoKey | null): Promise<DbFolder> {
  const encryptedName = folder.isSystem ? folder.name : await encryptText(folder.name, key);

  return {
    id: folder.id,
    name: encryptedName,
    icon: folder.icon || null,
    is_system: Boolean(folder.isSystem),
    updated_at: Date.now(),
    user_id: userId,
  };
}

/**
 * Safe AbortSignal helper for cross-platform compatibility across mobile WebView,
 * Android Capacitor, Safari, and Electron.
 */
function getAbortSignal(timeoutMs = 15000): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(timeoutMs);
    }
    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeoutMs);
      return controller.signal;
    }
  } catch (_) {}
  return undefined;
}

/**
 * Decrypts a DbFolder retrieved from PostgreSQL.
 */
export async function dbToFolder(db: DbFolder, key: CryptoKey | null): Promise<Folder> {
  let decryptedName = db.is_system ? db.name : await decryptText(db.name, key);
  if (!decryptedName || !decryptedName.trim()) {
    decryptedName = 'Untitled Folder';
  }

  return {
    id: db.id,
    name: decryptedName.trim(),
    icon: db.icon || undefined,
    isSystem: Boolean(db.is_system),
  };
}

export async function fetchUserNotes(key: CryptoKey | null, existingNotes?: Note[]): Promise<Note[]> {
  try {
    const { data, error } = await supabase.from('notes').select('*');

    if (error) {
      console.warn('Error fetching notes from Supabase:', error);
      return existingNotes || [];
    }

    if (!data || !Array.isArray(data)) {
      return existingNotes || [];
    }

    const existingMap = new Map<string, Note>();
    if (existingNotes) {
      for (const n of existingNotes) {
        existingMap.set(n.id, n);
      }
    }

    const notePromises = (data as DbNote[]).map(async (d) => {
      try {
        const local = existingMap.get(d.id);
        // Fast path: reuse decrypted content if updated_at is identical, but apply DB's latest folder_id, is_pinned, is_trash
        if (local && local.updatedAt === Number(d.updated_at)) {
          return {
            ...local,
            folderId: d.folder_id || 'default',
            isPinned: Boolean(d.is_pinned),
            isTrash: Boolean(d.is_trash),
          };
        }
        return await dbToNote(d, key);
      } catch (err) {
        console.warn('Failed to parse note:', d.id, err);
        return existingMap.get(d.id) || null;
      }
    });

    const parsedNotes = await Promise.all(notePromises);
    return parsedNotes.filter((n): n is Note => n !== null);
  } catch (err) {
    console.warn('fetchUserNotes network error:', err);
    return existingNotes || [];
  }
}

export async function fetchUserFolders(key: CryptoKey | null, existingFolders?: Folder[]): Promise<Folder[]> {
  try {
    const { data, error } = await supabase.from('folders').select('*');

    if (error) {
      console.warn('Error fetching folders from Supabase:', error);
      return existingFolders || [];
    }

    if (!data || !Array.isArray(data)) {
      return existingFolders || [];
    }

    const existingMap = new Map<string, Folder>();
    if (existingFolders) {
      for (const f of existingFolders) {
        existingMap.set(f.id, f);
      }
    }

    // Only process custom, non-system folders
    const rawFolders = (data as DbFolder[]).filter(
      (d) => d && d.id && !d.is_system && d.id !== 'default' && d.id !== 'checklists' && d.id !== 'trash'
    );

    const decryptedFolders = await Promise.all(
      rawFolders.map((d) => {
        const local = existingMap.get(d.id);
        if (local && (d.is_system || local.name === d.name)) {
          return Promise.resolve(local);
        }
        return dbToFolder(d, key);
      })
    );

    // Filter out any folders with empty names
    return decryptedFolders.filter(
      (f) => Boolean(f && f.name && f.name.trim() && f.id !== 'default' && f.id !== 'checklists' && f.id !== 'trash')
    );
  } catch (err) {
    console.warn('fetchUserFolders network error:', err);
    return existingFolders || [];
  }
}

export async function batchUpsertNotesToCloud(
  notes: Note[],
  userId: string,
  key: CryptoKey | null
): Promise<void> {
  if (!notes || notes.length === 0) return;
  try {
    const payloads = await Promise.all(notes.map((n) => noteToDb(n, userId, key)));
    const { error } = await supabase.from('notes').upsert(payloads);
    if (error) {
      console.warn('Batch upsert notes encountered error, falling back to individual upserts:', error);
      // Fallback: upsert individually so that one conflicting/corrupted note doesn't block the rest
      for (const p of payloads) {
        try {
          const { error: indErr } = await supabase.from('notes').upsert(p);
          if (indErr && indErr.code !== '42501') {
            console.warn('Individual note upsert failed:', indErr);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Failed batch upsert notes:', err);
  }
}

export async function batchUpsertFoldersToCloud(
  folders: Folder[],
  userId: string,
  key: CryptoKey | null
): Promise<void> {
  // Only upload valid custom folders; NEVER upload system folders (default, checklists, trash)
  const validFolders = (folders || []).filter(
    (f) => Boolean(f && f.id && f.name && f.name.trim() && !f.isSystem && f.id !== 'default' && f.id !== 'checklists' && f.id !== 'trash')
  );
  if (validFolders.length === 0) return;

  try {
    const payloads = await Promise.all(validFolders.map((f) => folderToDb(f, userId, key)));
    const { error } = await supabase.from('folders').upsert(payloads);
    if (error) {
      console.warn('Batch upsert folders encountered error, falling back to individual upserts:', error);
      // Fallback: upsert individually so a 42501 RLS conflict on static legacy folders (e.g. 'work') doesn't block custom folders
      for (const p of payloads) {
        try {
          const { error: indErr } = await supabase.from('folders').upsert(p);
          if (indErr && indErr.code !== '42501') {
            console.warn('Individual folder upsert failed:', indErr);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Failed batch upsert folders:', err);
  }
}

export async function upsertNoteToCloud(note: Note, userId: string, key: CryptoKey | null): Promise<void> {
  try {
    const payload = await noteToDb(note, userId, key);
    const { error } = await supabase.from('notes').upsert(payload);
    if (error) {
      console.warn('Error upserting note to Supabase:', error);
    }
  } catch (err) {
    console.warn('Failed to upsert note to cloud:', err);
  }
}

export async function deleteNoteFromCloud(noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) {
    console.warn('Error deleting note from Supabase:', error);
  }
}

export async function upsertFolderToCloud(folder: Folder, userId: string, key: CryptoKey | null): Promise<void> {
  const payload = await folderToDb(folder, userId, key);
  const { error } = await supabase.from('folders').upsert(payload);
  if (error) {
    console.warn('Error upserting folder to Supabase:', error);
  }
}

export async function deleteFolderFromCloud(folderId: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', folderId);
  if (error) {
    console.warn('Error deleting folder from Supabase:', error);
  }
}

/**
 * Merge local and remote notes using last-write-wins (updatedAt) and tombstone/synced tracking
 */
export function mergeNotes(
  local: Note[],
  remote: Note[],
  syncedIds?: Set<string>
): { merged: Note[]; toUpload: Note[] } {
  const map = new Map<string, Note>();
  const toUpload: Note[] = [];

  // Index remote notes
  for (const r of remote) {
    map.set(r.id, r);
  }

  // Merge local notes
  for (const l of local) {
    const existing = map.get(l.id);
    if (!existing) {
      // If note was previously confirmed synced to cloud but is now gone from cloud,
      // it was deleted from another device. Do not resurrect it.
      if (syncedIds && syncedIds.has(l.id)) {
        continue;
      }
      // Brand new local note not in cloud -> upload to cloud
      map.set(l.id, l);
      toUpload.push(l);
    } else if (l.updatedAt > existing.updatedAt) {
      // Local note is newer -> upload to cloud
      map.set(l.id, l);
      toUpload.push(l);
    }
  }

  return {
    merged: Array.from(map.values()),
    toUpload,
  };
}

/**
 * Merge custom folders (ignoring system folders and empty names)
 */
export function mergeFolders(
  local: Folder[],
  remote: Folder[]
): { merged: Folder[]; toUpload: Folder[] } {
  const map = new Map<string, Folder>();
  const toUpload: Folder[] = [];

  for (const r of remote) {
    if (r && r.name && r.name.trim() && !r.isSystem && r.id !== 'default' && r.id !== 'checklists' && r.id !== 'trash') {
      map.set(r.id, { ...r, name: r.name.trim() });
    }
  }

  for (const l of local) {
    if (l && l.name && l.name.trim() && !l.isSystem && l.id !== 'default' && l.id !== 'checklists' && l.id !== 'trash') {
      if (!map.has(l.id)) {
        map.set(l.id, { ...l, name: l.name.trim() });
        toUpload.push(l);
      }
    }
  }

  return {
    merged: Array.from(map.values()),
    toUpload,
  };
}
