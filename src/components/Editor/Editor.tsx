import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { RotateCcw, Trash2, Folder as FolderIcon } from 'lucide-react';

import { useNotes } from '../../store/NotesContext';
import { formatEditorDate } from '../../utils/dateUtils';
import { EditorToolbar } from './EditorToolbar';

interface EditorProps {
  showToolbar: boolean;
  onRegisterToggleChecklist: (fn: () => void) => void;
}

export const Editor: React.FC<EditorProps> = ({ showToolbar, onRegisterToggleChecklist }) => {
  const {
    activeNote,
    createNote,
    updateNote,
    folders,
    moveNoteToFolder,
    restoreNote,
    permanentlyDeleteNote,
  } = useNotes();

  const isUpdatingRef = useRef(false);
  const activeNoteRef = useRef(activeNote);
  activeNoteRef.current = activeNote;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type something...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: activeNote ? activeNote.content : '',
    editable: Boolean(activeNote && !activeNote.isTrash),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[60vh] cursor-text select-text',
      },
    },
    onUpdate: ({ editor, transaction }) => {
      const currentNote = activeNoteRef.current;
      // Only process when document actually changed from user edits
      if (!currentNote || isUpdatingRef.current || !transaction.docChanged) return;

      const html = editor.getHTML();
      if (html === currentNote.content) return;

      const text = editor.getText();

      // Extract title and snippet preview from text
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines.length > 0 ? lines[0].substring(0, 80) : 'New Note';
      const plainTextPreview = lines.length > 1
        ? lines.slice(1).join(' ').substring(0, 150)
        : (lines.length === 1 && lines[0] !== title ? lines[0] : 'No additional text');

      updateNote(currentNote.id, {
        content: html,
        title,
        plainTextPreview,
      });
    },
  });

  // Register checklist toggle callback with parent
  useEffect(() => {
    if (editor) {
      onRegisterToggleChecklist(() => {
        editor.chain().focus().toggleTaskList().run();
      });
    }
  }, [editor, onRegisterToggleChecklist]);

  // Update editor content and editable state when active note changes
  useEffect(() => {
    if (!editor || !activeNote) return;

    editor.setEditable(!activeNote.isTrash);

    const currentHTML = editor.getHTML();
    if (currentHTML !== activeNote.content) {
      isUpdatingRef.current = true;
      editor.commands.setContent(activeNote.content, false);
      const timer = setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
      return () => {
        clearTimeout(timer);
        isUpdatingRef.current = false;
      };
    }
  }, [activeNote?.id, activeNote?.isTrash, editor]);

  if (!activeNote) {
    return (
      <div className="flex-1 bg-white dark:bg-[#1e1e1e] flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 select-none p-6 text-center">
        <p className="text-sm mb-3">Select a note or create a new one</p>
        <button
          onClick={() => createNote()}
          className="px-3 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          Create Note
        </button>
      </div>
    );
  }

  const noteFolder = folders.find(f => f.id === activeNote.folderId);

  return (
    <div className="flex-1 bg-white dark:bg-[#1e1e1e] flex flex-col h-full overflow-hidden relative select-text">
      {/* Optional Toolbar */}
      <EditorToolbar editor={editor} isVisible={showToolbar} />

      {/* Trash Warning Banner */}
      {activeNote.isTrash && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <span>This note is in Recently Deleted.</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => restoreNote(activeNote.id)}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-amber-200/60 dark:bg-amber-800/60 hover:bg-amber-300 dark:hover:bg-amber-700 font-medium transition-colors"
            >
              <RotateCcw size={14} />
              <span>Restore</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Permanently delete this note? This action cannot be undone.')) {
                  permanentlyDeleteNote(activeNote.id);
                }
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-red-100 dark:bg-red-900/60 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 font-medium transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Body (Scrollable container - date moves away on scroll) */}
      <div
        className="flex-1 overflow-y-auto px-5 md:px-14 py-3 cursor-text select-text"
        onClick={(e) => {
          if (editor && !activeNote.isTrash) {
            const target = e.target as HTMLElement;
            // If clicked on empty space around or below the text, focus the editor at the end
            if (!target.closest('.ProseMirror') && !target.closest('select') && !target.closest('button')) {
              editor.commands.focus('end');
            }
          }
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Note Meta Header: Date & Folder selector scrolls away with note content */}
          <div className="pt-2 pb-3 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 select-none relative">
            {/* Date Stamp */}
            <span className="mx-auto font-medium text-center">
              {formatEditorDate(activeNote.updatedAt)}
            </span>

            {/* Folder Mover Dropdown */}
            {!activeNote.isTrash && (
              <div className="absolute right-0 top-1.5 flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 rounded-full text-[11px] text-neutral-600 dark:text-neutral-400 shadow-xs border border-neutral-200/50 dark:border-neutral-700/50">
                <FolderIcon size={11} className="text-apple-yellow shrink-0" />
                <select
                  value={activeNote.folderId}
                  onChange={(e) => moveNoteToFolder(activeNote.id, e.target.value)}
                  className="bg-transparent border-none outline-none cursor-pointer text-neutral-600 dark:text-neutral-300 pr-1 text-[11px]"
                >
                  <option value="default">Notes</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <EditorContent
            editor={editor}
            className="prose prose-neutral dark:prose-invert focus:outline-none min-h-[60vh] select-text cursor-text"
            onClick={() => {
              if (editor && !editor.isFocused && !activeNote.isTrash) {
                editor.commands.focus();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

