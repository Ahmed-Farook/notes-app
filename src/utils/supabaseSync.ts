import { Note, Folder } from '../types/note';
import { supabase } from '../lib/supabase';
import { encryptText, decryptText } from './crypto';

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
  // Bundle handwritten drawing strokes and trash deletion timestamp securely with content
  const needsBundle = Boolean(note.drawingStrokes || note.deletedAt);
  const rawContent = needsBundle
    ? JSON.stringify({
        html: note.content || '',
        ...(note.drawingStrokes ? { strokes: note.drawingStrokes } : {}),
        ...(note.deletedAt ? { deletedAt: note.deletedAt } : {}),
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

  let content = decryptedContent;
  let drawingStrokes: string | undefined = undefined;
  let deletedAt: number | undefined = undefined;

  // Unpack bundled drawing strokes / deletedAt if present
  if (decryptedContent.startsWith('{"html":')) {
    try {
      const parsed = JSON.parse(decryptedContent);
      content = parsed.html || '';
      drawingStrokes = parsed.strokes;
      if (typeof parsed.deletedAt === 'number') {
        deletedAt = parsed.deletedAt;
      }
    } catch (_) {}
  }

  return {
    id: db.id,
    title: decryptedTitle,
    content,
    drawingStrokes,
    plainTextPreview: decryptedPreview,
    folderId: db.folder_id,
    isPinned: db.is_pinned,
    isTrash: db.is_trash,
    deletedAt,
    createdAt: Number(db.created_at),
    updatedAt: Number(db.updated_at),
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
 * Decrypts a DbFolder retrieved from PostgreSQL.
 */
export async function dbToFolder(db: DbFolder, key: CryptoKey | null): Promise<Folder> {
  const decryptedName = db.is_system ? db.name : await decryptText(db.name, key);

  return {
    id: db.id,
    name: decryptedName,
    icon: db.icon || undefined,
    isSystem: db.is_system,
  };
}

export async function fetchUserNotes(key: CryptoKey | null): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select('*');
  if (error) {
    console.warn('Error fetching notes from Supabase:', error);
    return [];
  }
  return Promise.all((data as DbNote[]).map((d) => dbToNote(d, key)));
}

export async function fetchUserFolders(key: CryptoKey | null): Promise<Folder[]> {
  const { data, error } = await supabase.from('folders').select('*');
  if (error) {
    console.warn('Error fetching folders from Supabase:', error);
    return [];
  }
  return Promise.all((data as DbFolder[]).map((d) => dbToFolder(d, key)));
}

export async function upsertNoteToCloud(note: Note, userId: string, key: CryptoKey | null): Promise<void> {
  const payload = await noteToDb(note, userId, key);
  const { error } = await supabase.from('notes').upsert(payload);
  if (error) {
    console.warn('Error upserting note to Supabase:', error);
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
 * Merge local and remote notes using last-write-wins (updatedAt)
 */
export function mergeNotes(
  local: Note[],
  remote: Note[]
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
      // Local note not in cloud -> upload to cloud
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
 * Merge custom folders
 */
export function mergeFolders(
  local: Folder[],
  remote: Folder[]
): { merged: Folder[]; toUpload: Folder[] } {
  const map = new Map<string, Folder>();
  const toUpload: Folder[] = [];

  for (const r of remote) {
    map.set(r.id, r);
  }

  for (const l of local) {
    if (!map.has(l.id)) {
      map.set(l.id, l);
      toUpload.push(l);
    }
  }

  return {
    merged: Array.from(map.values()),
    toUpload,
  };
}
