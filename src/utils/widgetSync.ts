import { Capacitor } from '@capacitor/core';
import { Note } from '../types/note';

export interface WidgetTodoItem {
  text: string;
  checked: boolean;
}

export const WIDGET_PINNED_NOTE_KEY = 'texo_pinned_widget_note_id';

export function getWidgetPinnedNoteId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WIDGET_PINNED_NOTE_KEY);
}

export function setWidgetPinnedNoteId(noteId: string | null): void {
  if (typeof window === 'undefined') return;
  if (noteId) {
    localStorage.setItem(WIDGET_PINNED_NOTE_KEY, noteId);
  } else {
    localStorage.removeItem(WIDGET_PINNED_NOTE_KEY);
  }
}

/**
 * Extracts task list checklist items from a Note's HTML content.
 */
export function extractChecklistFromHtml(html: string): WidgetTodoItem[] {
  if (!html) return [];
  const items: WidgetTodoItem[] = [];

  try {
    if (typeof document !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const taskNodes = doc.querySelectorAll('li[data-type="taskItem"], li:has(input[type="checkbox"])');

      taskNodes.forEach((node) => {
        const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const isChecked = node.getAttribute('data-checked') === 'true' || Boolean(checkbox?.checked);

        // Clone node and remove checkbox element to get pure text content
        const clone = node.cloneNode(true) as HTMLElement;
        const cb = clone.querySelector('input[type="checkbox"]');
        if (cb) cb.remove();

        const text = (clone.textContent || '').trim();
        if (text) {
          items.push({
            text,
            checked: isChecked,
          });
        }
      });
    }
  } catch (_) {}

  // Fallback regex parser if DOMParser is unavailable or finds none
  if (items.length === 0) {
    const taskRegex = /<li[^>]*data-type=["']taskItem["'][^>]*data-checked=["'](true|false)["'][^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;
    while ((match = taskRegex.exec(html)) !== null) {
      const isChecked = match[1].toLowerCase() === 'true';
      const cleanText = match[2].replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        items.push({ text: cleanText, checked: isChecked });
      }
    }
  }

  return items;
}

/**
 * Updates taskItem checked state at a specific index in a Note's HTML.
 */
export function toggleTaskItemInHtml(html: string, targetIndex: number, checked: boolean): string {
  if (!html) return html;
  try {
    if (typeof document !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');

      if (targetIndex >= 0 && targetIndex < taskNodes.length) {
        const target = taskNodes[targetIndex];
        target.setAttribute('data-checked', checked ? 'true' : 'false');
        const cb = target.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (cb) {
          cb.checked = checked;
          if (checked) {
            cb.setAttribute('checked', 'checked');
          } else {
            cb.removeAttribute('checked');
          }
        }
        return doc.body.innerHTML;
      }
    }
  } catch (_) {}

  return html;
}

/**
 * Finds the most relevant note for the widget:
 * 1. The note explicitly pinned to the widget by the user.
 * 2. The currently active note if it has checklist items or text.
 * 3. Or a pinned note that contains checklist items.
 * 4. Or the latest updated note with checklist items.
 * 5. Or the latest non-trash note.
 */
export function findBestWidgetNote(notes: Note[], activeNoteId: string | null): Note | null {
  const activeNotes = notes.filter((n) => !n.isTrash && !n.isLocked);
  if (activeNotes.length === 0) return null;

  // 1. Explicit user selection for widget
  const pinnedWidgetId = getWidgetPinnedNoteId();
  if (pinnedWidgetId) {
    const chosen = activeNotes.find((n) => n.id === pinnedWidgetId);
    if (chosen) return chosen;
  }

  // 2. Active note if it is in checklists folder
  if (activeNoteId) {
    const active = activeNotes.find((n) => n.id === activeNoteId);
    if (active && active.folderId === 'checklists') {
      return active;
    }
  }

  // 3. Most recently updated note in checklists folder
  const checklistFolderNote = activeNotes.find((n) => n.folderId === 'checklists');
  if (checklistFolderNote) return checklistFolderNote;

  // 4. Active note (fallback)
  if (activeNoteId) {
    const active = activeNotes.find((n) => n.id === activeNoteId);
    if (active) return active;
  }

  // 6. Pinned note or first note
  const pinned = activeNotes.find((n) => n.isPinned);
  if (pinned) return pinned;

  return activeNotes[0] || null;
}

/**
 * Syncs the selected note and its checklist items to the Android home screen widget.
 */
export async function syncNoteToAndroidWidget(notes: Note[], activeNoteId: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  const widgetPlugin = win?.Capacitor?.Plugins?.NotesWidget;
  if (!widgetPlugin?.updateWidgetData) return;

  const targetNote = findBestWidgetNote(notes, activeNoteId);
  if (!targetNote) {
    try {
      await widgetPlugin.updateWidgetData({
        noteId: '',
        title: 'To-Do List',
        items: [],
      });
    } catch (_) {}
    return;
  }

  const items = extractChecklistFromHtml(targetNote.content || '');

  // If note has no checklist items, include first few plain text lines as items
  const widgetItems =
    items.length > 0
      ? items
      : (targetNote.plainTextPreview || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 6)
          .map((text) => ({ text, checked: false }));

  try {
    await widgetPlugin.updateWidgetData({
      noteId: targetNote.id,
      title: targetNote.title || 'To-Do List',
      items: widgetItems,
    });
    // Also sync all available checklists for multi-widget note selection
    await syncAllChecklistsToAndroidWidget(notes);
  } catch (err) {
    console.warn('Failed to sync data to Android widget:', err);
  }
}

/**
 * Syncs all available checklists to Android so each home screen widget can choose and display its list.
 */
export async function syncAllChecklistsToAndroidWidget(notes: Note[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  const widgetPlugin = win?.Capacitor?.Plugins?.NotesWidget;
  if (!widgetPlugin?.syncAllChecklists) return;

  const checklistNotes = notes.filter(
    (n) => !n.isTrash && !n.isLocked && n.folderId === 'checklists'
  );

  const payload = checklistNotes.map((note) => ({
    id: note.id,
    title: note.title || 'To-Do List',
    items: extractChecklistFromHtml(note.content || ''),
  }));

  try {
    await widgetPlugin.syncAllChecklists({ checklists: payload });
  } catch (err) {
    console.warn('Failed to sync all checklists to Android:', err);
  }
}

/**
 * Checks for any to-do items toggled directly on the Android widget while the app was in the background.
 */
export async function syncPendingWidgetToggles(
  notes: Note[],
  updateNote: (id: string, updates: Partial<Note>) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  const widgetPlugin = win?.Capacitor?.Plugins?.NotesWidget;
  if (!widgetPlugin?.getPendingToggles) return;

  try {
    const res = await widgetPlugin.getPendingToggles();
    const toggles = res?.toggles;
    if (Array.isArray(toggles) && toggles.length > 0) {
      for (const t of toggles) {
        const { noteId, itemIndex, checked } = t;
        const target = notes.find((n) => n.id === noteId);
        if (target && target.content) {
          const updatedHtml = toggleTaskItemInHtml(target.content, itemIndex, checked);
          if (updatedHtml !== target.content) {
            updateNote(noteId, { content: updatedHtml });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to apply pending widget toggles:', err);
  }
}
