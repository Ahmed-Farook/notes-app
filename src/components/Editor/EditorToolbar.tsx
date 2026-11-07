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

  const getBtnClass = (isActive: boolean) =>
    `p-1.5 rounded shrink-0 transition-colors ${
      isActive
        ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
        : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
    }`;

  return (
    <div className="h-10 flex flex-nowrap items-center gap-1 px-3 border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur sticky top-0 z-20 select-none text-xs overflow-x-auto no-scrollbar shrink-0">
      {/* Text Style Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Title (H1)"
        className={getBtnClass(editor.isActive('heading', { level: 1 }))}
      >
        <Heading1 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading (H2)"
        className={getBtnClass(editor.isActive('heading', { level: 2 }))}
      >
        <Heading2 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Subheading (H3)"
        className={getBtnClass(editor.isActive('heading', { level: 3 }))}
      >
        <Heading3 size={15} />
      </button>

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

      {/* Basic Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
        className={getBtnClass(editor.isActive('bold'))}
      >
        <Bold size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
        className={getBtnClass(editor.isActive('italic'))}
      >
        <Italic size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Cmd+U)"
        className={getBtnClass(editor.isActive('underline'))}
      >
        <UnderlineIcon size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
        className={getBtnClass(editor.isActive('strike'))}
      >
        <Strikethrough size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
        className={`p-1.5 rounded shrink-0 transition-colors ${
          editor.isActive('highlight')
            ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
            : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
        }`}
      >
        <Highlighter size={15} />
      </button>

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Checklist"
        className={getBtnClass(editor.isActive('taskList'))}
      >
        <CheckSquare size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
        className={getBtnClass(editor.isActive('bulletList'))}
      >
        <List size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
        className={getBtnClass(editor.isActive('orderedList'))}
      >
        <ListOrdered size={15} />
      </button>

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

      {/* Quotes & Code */}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
        className={getBtnClass(editor.isActive('blockquote'))}
      >
        <Quote size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
        className={getBtnClass(editor.isActive('codeBlock'))}
      >
        <Code size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Divider"
        className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] transition-colors"
      >
        <Minus size={15} />
      </button>

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

      {/* Undo / Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
        className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Undo2 size={15} />
      </button>

      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
        className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Redo2 size={15} />
      </button>
    </div>
  );
};

