import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  isVisible: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, isVisible }) => {
  if (!editor || !isVisible) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-apple-border dark:border-apple-borderDark bg-white/80 dark:bg-neutral-900/80 backdrop-blur sticky top-0 z-20 select-none text-xs">
      {/* Text Style Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Title (H1)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('heading', { level: 1 })
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Heading1 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading (H2)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Heading2 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Subheading (H3)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Heading3 size={15} />
      </button>

      <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

      {/* Basic Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('bold')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Bold size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('italic')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Italic size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Cmd+U)"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('underline')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <UnderlineIcon size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('strike')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Strikethrough size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('highlight')
            ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Highlighter size={15} />
      </button>

      <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Checklist"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('taskList')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <CheckSquare size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('bulletList')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <List size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('orderedList')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <ListOrdered size={15} />
      </button>

      <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

      {/* Quotes & Code */}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('blockquote')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Quote size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
          editor.isActive('codeBlock')
            ? 'bg-neutral-200 dark:bg-neutral-700 text-apple-yellow font-bold'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        <Code size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Divider"
        className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
      >
        <Minus size={15} />
      </button>

      <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
        className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Undo2 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
        className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Redo2 size={15} />
      </button>
    </div>
  );
};

