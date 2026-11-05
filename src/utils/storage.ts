import { Folder, Note } from '../types/note';

const NOTES_STORAGE_KEY = 'apple_notes_data_v1';
const FOLDERS_STORAGE_KEY = 'apple_notes_folders_v1';

export const SYSTEM_FOLDERS: Folder[] = [
  { id: 'all', name: 'All Notes', isSystem: true },
  { id: 'quick', name: 'Quick Notes', isSystem: true },
  { id: 'default', name: 'Notes', isSystem: true },
  { id: 'trash', name: 'Recently Deleted', isSystem: true },
];

export const INITIAL_FOLDERS: Folder[] = [
  { id: 'work', name: 'Work & Projects' },
  { id: 'personal', name: 'Personal & Ideas' },
];

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-welcome',
    title: 'Welcome to notes-app',
    content: `<h1>Welcome to notes-app 👋</h1><p>We're so glad you're here! This is your clean, distraction-free space for capturing quick thoughts, daily to-dos, and big ideas.</p><p>Everything you write is saved automatically to your device with <strong>0ms local speed</strong>, works completely offline, and can be synced across all your devices with <strong>Zero-Knowledge End-to-End Encryption</strong>.</p><h3>✨ A few things to try:</h3><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Check off items on your to-do lists</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Create a fresh note with <strong>New Note</strong> (or press <code>Cmd+N</code> / <code>Ctrl+N</code>)</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Organize your ideas into custom folders in the sidebar</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Sign in to sync seamlessly between macOS, Windows, Android, and Web</p></div></li></ul><p></p><blockquote><p>“Simplicity is the ultimate sophistication.” — Make yourself at home and happy writing! 💛</p></blockquote>`,
    plainTextPreview: "We're so glad you're here! This is your clean, distraction-free space for capturing quick thoughts, daily to-dos, and big ideas...",
    folderId: 'default',
    isPinned: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const loadStoredNotes = (): Note[] => {
  try {
    const data = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!data) return INITIAL_NOTES;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_NOTES;

    // Migrate users who still have the legacy 3 default sample notes
    const isLegacyDefault =
      parsed.length === 3 &&
      parsed.some((n: any) => n.id === 'note-roadmap') &&
      parsed.some((n: any) => n.id === 'note-weekend-ideas');
    if (isLegacyDefault) {
      saveStoredNotes(INITIAL_NOTES);
      return INITIAL_NOTES;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load notes from localStorage', err);
    return INITIAL_NOTES;
  }
};

export const saveStoredNotes = (notes: Note[]): void => {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to save notes to localStorage', err);
  }
};

export const loadStoredFolders = (): Folder[] => {
  try {
    const data = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!data) return INITIAL_FOLDERS;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_FOLDERS;
  } catch (err) {
    console.error('Failed to load folders from localStorage', err);
    return INITIAL_FOLDERS;
  }
};

export const saveStoredFolders = (folders: Folder[]): void => {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (err) {
    console.error('Failed to save folders to localStorage', err);
  }
};

