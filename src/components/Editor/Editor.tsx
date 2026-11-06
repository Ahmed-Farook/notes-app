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
    updateNote,
    folders,
    moveNoteToFolder,
    restoreNote,
    permanentlyDeleteNote,
  } = useNotes();

  const isUpdatingRef = useRef(false);

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
    onUpdate: ({ editor }) => {
      if (!activeNote || isUpdatingRef.current) return;

      const html = editor.getHTML();
      const text = editor.getText();

      // Extract title and snippet preview from text
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines.length > 0 ? lines[0].substring(0, 80) : 'New Note';
      const plainTextPreview = lines.length > 1
        ? lines.slice(1).join(' ').substring(0, 150)
        : (lines.length === 1 && lines[0] !== title ? lines[0] : 'No additional text');

      updateNote(activeNote.id, {
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

  // Update editor content when active note changes
  useEffect(() => {
    if (editor && activeNote) {
      const currentHTML = editor.getHTML();
      if (currentHTML !== activeNote.content) {
        isUpdatingRef.current = true;
        editor.commands.setContent(activeNote.content, false);
        isUpdatingRef.current = false;
      }
      editor.setEditable(!activeNote.isTrash);
    }
  }, [activeNote?.id, editor]);

  if (!activeNote) {
    return (
      <div className="flex-1 bg-white dark:bg-[#1e1e1e] flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 select-none">
        <p className="text-sm">Select a note or create a new one</p>
      </div>
    );
  }

  const noteFolder = folders.find(f => f.id === activeNote.folderId);

  return (
    <div className="flex-1 bg-white dark:bg-[#1e1e1e] flex flex-col h-full overflow-hidden relative">
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
              <RotateCcw size={12} />
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
              <Trash2 size={12} />
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* Note Meta Header: Date & Folder selector */}
      <div className="pt-4 pb-2 px-8 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 select-none">
        {/* Date Stamp */}
        <span className="mx-auto font-medium">
          {formatEditorDate(activeNote.updatedAt)}
        </span>

        {/* Folder Mover Dropdown */}
        {!activeNote.isTrash && (
          <div className="absolute right-6 top-3 flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[11px] text-neutral-600 dark:text-neutral-400">
            <FolderIcon size={11} className="text-apple-yellow" />
            <select
              value={activeNote.folderId}
              onChange={(e) => moveNoteToFolder(activeNote.id, e.target.value)}
              className="bg-transparent border-none outline-none cursor-pointer text-neutral-600 dark:text-neutral-300 pr-1"
            >
              <option value="default">Notes</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Editor Content Body */}
      <div
        className="flex-1 overflow-y-auto px-8 md:px-14 py-4 cursor-text"
        onClick={() => {
          if (editor && !editor.isFocused && !activeNote.isTrash) {
            editor.commands.focus('end');
          }
        }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto focus:outline-none min-h-[500px]"
        />
      </div>
    </div>
  );
};

