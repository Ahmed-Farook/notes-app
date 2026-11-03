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
    title: 'Welcome to Cross-Platform Notes 📝',
    content: `<h1>Welcome to Cross-Platform Notes 📝</h1><p>An open, lightweight, and modern notes app inspired by <strong>Apple Notes</strong>, designed to run everywhere — macOS, Windows, Linux, and the web!</p><h3>✨ Key Features:</h3><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Clean 3-column Apple layout with collapsible sidebars</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Rich text formatting: <strong>Bold</strong>, <em>Italic</em>, <u>Underline</u>, and <mark>Highlights</mark></p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Interactive checklists with instant strike-through</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Automatic note title &amp; snippet detection</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Instant search across all note titles and body contents</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Pin your most important notes to the top</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Folders and Recently Deleted trash management</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Export notes to Markdown or plain text</p></div></li></ul><p></p><blockquote><p>“Simplicity is the ultimate sophistication.” — Steve Jobs</p></blockquote><p>Start typing right here or press <strong>New Note</strong> in the toolbar above to create your next idea!</p>`,
    plainTextPreview: 'An open, lightweight, and modern notes app inspired by Apple Notes, designed to run everywhere...',
    folderId: 'default',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
    updatedAt: Date.now() - 1000 * 60 * 30, // 30 mins ago
  },
  {
    id: 'note-roadmap',
    title: 'Cross-Platform App Roadmap 🚀',
    content: `<h1>Cross-Platform App Roadmap 🚀</h1><p>Here is what makes this app 100% cross-platform compatible:</p><ol><li><strong>Web / PWA:</strong> Accessible on any modern browser, installable as a standalone app with offline support.</li><li><strong>Desktop (macOS / Windows / Linux):</strong> Wrappable via <em>Electron</em> or <em>Tauri</em> for native window frame and tray shortcuts.</li><li><strong>Local-First Storage:</strong> Works completely offline with zero latency.</li><li><strong>Sync Backend:</strong> Optional end-to-end encrypted sync (Supabase, Firebase, or self-hosted CouchDB).</li></ol>`,
    plainTextPreview: 'Here is what makes this app 100% cross-platform compatible: Web, Desktop, Local-First...',
    folderId: 'work',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: 'note-weekend-ideas',
    title: 'Weekend Project Ideas',
    content: `<h1>Weekend Project Ideas</h1><p>Quick list of fun things to build and try out:</p><ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Set up automatic note backup to local folder</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Try out Tauri desktop bundling for ultra-lightweight binary</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Build Apple Notes classic paper texture and gold styling</p></div></li></ul>`,
    plainTextPreview: 'Quick list of fun things to build and try out: Set up automatic note backup, Try Tauri...',
    folderId: 'personal',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    updatedAt: Date.now() - 1000 * 60 * 60 * 4,
  }
];

export const loadStoredNotes = (): Note[] => {
  try {
    const data = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!data) return INITIAL_NOTES;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_NOTES;
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
