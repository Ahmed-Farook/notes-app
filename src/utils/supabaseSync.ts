import { Note, Folder } from '../types/note';
import { supabase } from '../lib/supabase';

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

export function noteToDb(note: Note, userId: string): DbNote {
  return {
    id: note.id,
    title: note.title || '',
    content: note.content || '',
    plain_text_preview: note.plainTextPreview || '',
    folder_id: note.folderId || 'default',
    is_pinned: Boolean(note.isPinned),
    is_trash: Boolean(note.isTrash),
    created_at: note.createdAt || Date.now(),
    updated_at: note.updatedAt || Date.now(),
    user_id: userId,
  };
}

export function dbToNote(db: DbNote): Note {
  return {
    id: db.id,
    title: db.title,
    content: db.content,
    plainTextPreview: db.plain_text_preview,
    folderId: db.folder_id,
    isPinned: db.is_pinned,
    isTrash: db.is_trash,
    createdAt: Number(db.created_at),
    updatedAt: Number(db.updated_at),
  };
}

export function folderToDb(folder: Folder, userId: string): DbFolder {
  return {
    id: folder.id,
    name: folder.name,
    icon: folder.icon || null,
    is_system: Boolean(folder.isSystem),
    updated_at: Date.now(),
    user_id: userId,
  };
}

export function dbToFolder(db: DbFolder): Folder {
  return {
    id: db.id,
    name: db.name,
    icon: db.icon || undefined,
    isSystem: db.is_system,
  };
}

export async function fetchUserNotes(): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select('*');
  if (error) {
    console.warn('Error fetching notes from Supabase:', error);
    return [];
  }
  return (data as DbNote[]).map(dbToNote);
}

export async function fetchUserFolders(): Promise<Folder[]> {
  const { data, error } = await supabase.from('folders').select('*');
  if (error) {
    console.warn('Error fetching folders from Supabase:', error);
    return [];
  }
  return (data as DbFolder[]).map(dbToFolder);
}

export async function upsertNoteToCloud(note: Note, userId: string): Promise<void> {
  const payload = noteToDb(note, userId);
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

export async function upsertFolderToCloud(folder: Folder, userId: string): Promise<void> {
  const payload = folderToDb(folder, userId);
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
