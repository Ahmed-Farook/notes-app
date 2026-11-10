import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Keyboard,
  PenTool,
  Highlighter,
  Eraser,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter as TextHighlightIcon,
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
  Trash2,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { toggleUnifiedCodeBlock } from '../../utils/editorCommands';

const PRESET_COLORS = [
  { name: 'Kyoto Indigo', value: '#213A50' },
  { name: 'Charcoal', value: '#1C2B36' },
  { name: 'Pure White', value: '#FFFFFF' },
  { name: 'Vermilion Red', value: '#DC2626' },
  { name: 'Amber Gold', value: '#D97706' },
  { name: 'Emerald Green', value: '#059669' },
  { name: 'Cobalt Blue', value: '#2563EB' },
  { name: 'Purple Orchid', value: '#7C3AED' },
  { name: 'Neon Yellow', value: '#FACC15' },
  { name: 'Blush Pink', value: '#F472B6' },
];

const STROKE_SIZES = [
  { label: 'Fine', value: 2.5 },
  { label: 'Medium', value: 5 },
  { label: 'Bold', value: 9 },
  { label: 'Broad', value: 16 },
];

interface EditorToolbarProps {
  editor: Editor | null;
  isVisible: boolean;
  // Samsung Notes Seamless In-Note Drawing State
  isPenMode: boolean;
  onTogglePenMode: (penMode: boolean) => void;
  activeDrawingTool: 'pen' | 'highlighter' | 'eraser';
  onChangeDrawingTool: (tool: 'pen' | 'highlighter' | 'eraser') => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  activeSize: number;
  onChangeSize: (size: number) => void;
  canDrawingUndo: boolean;
  canDrawingRedo: boolean;
  onDrawingUndo: () => void;
  onDrawingRedo: () => void;
  onDrawingClear: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  isVisible,
  isPenMode,
  onTogglePenMode,
  activeDrawingTool,
  onChangeDrawingTool,
  activeColor,
  onChangeColor,
  activeSize,
  onChangeSize,
  canDrawingUndo,
  canDrawingRedo,
  onDrawingUndo,
  onDrawingRedo,
  onDrawingClear,
}) => {
  if (!editor || !isVisible) return null;

  const runCommand = (cmd: () => void) => {
    triggerHaptic();
    cmd();
  };

  const getBtnClass = (isActive: boolean) =>
    `p-1.5 rounded shrink-0 transition-colors ${
      isActive
        ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
        : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
    }`;

  return (
    <div className="h-10 flex flex-nowrap items-center gap-1.5 px-2.5 border-t md:border-t-0 md:border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur md:sticky md:top-0 z-30 select-none text-xs overflow-x-auto no-scrollbar shrink-0 order-last md:order-first">
      {/* Samsung Notes Mode Switcher: [Type] vs [Draw] */}
      <div className="flex items-center bg-[#E5DCCB]/90 dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-lg p-0.5 shrink-0 shadow-xs">
        <button
          onClick={() => {
            triggerHaptic();
            onTogglePenMode(false);
          }}
          title="Type (Keyboard Text Mode)"
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
            !isPenMode
              ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-[#E8EEF3] shadow-xs'
              : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
          }`}
        >
          <Keyboard size={13} />
          <span>Type</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic();
            onTogglePenMode(true);
          }}
          title="Draw (Samsung Notes Stylus & Pen Mode)"
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
            isPenMode
              ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
              : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
          }`}
        >
          <PenTool size={13} />
          <span>Draw</span>
        </button>
      </div>

      <div className="h-4 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

      {/* When in Pen Mode: Show Samsung Notes drawing tools */}
      {isPenMode ? (
        <>
          {/* Tool selector: Pen, Highlighter, Eraser */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                triggerHaptic();
                onChangeDrawingTool('pen');
              }}
              title="Pen (Natural Ink with Stylus Pressure)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all ${
                activeDrawingTool === 'pen'
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <PenTool size={14} />
              <span className="hidden sm:inline">Pen</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                triggerHaptic();
                onChangeDrawingTool('highlighter');
              }}
              title="Highlighter (Translucent Chisel)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all ${
                activeDrawingTool === 'highlighter'
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <Highlighter size={14} />
              <span className="hidden sm:inline">Highlighter</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                triggerHaptic();
                onChangeDrawingTool('eraser');
              }}
              title="Eraser (Tap or Drag across strokes to erase)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all ${
                activeDrawingTool === 'eraser'
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <Eraser size={14} />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          </div>

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Stroke Size Selector */}
          <div className="flex items-center space-x-1 shrink-0">
            {STROKE_SIZES.map((sz) => (
              <button
                key={sz.label}
                onClick={() => {
                  triggerHaptic();
                  onChangeSize(sz.value);
                }}
                title={`${sz.label} (${sz.value}px)`}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  activeSize === sz.value
                    ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white ring-1 ring-apple-yellow'
                    : 'bg-[#E5DCCB]/60 dark:bg-[#1A2530] text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB]'
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: `${Math.min(12, sz.value + 1.5)}px`,
                    height: `${Math.min(12, sz.value + 1.5)}px`,
                  }}
                />
              </button>
            ))}
          </div>

          {/* Color Palette (hidden in eraser mode) */}
          {activeDrawingTool !== 'eraser' && (
            <>
              <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />
              <div className="flex items-center space-x-1 shrink-0">
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col.value}
                    onClick={() => {
                      triggerHaptic();
                      onChangeColor(col.value);
                    }}
                    title={col.name}
                    className={`w-5 h-5 rounded-full transition-transform shrink-0 ${
                      activeColor === col.value
                        ? 'scale-125 ring-2 ring-offset-1 ring-apple-yellow dark:ring-[#7EAAD0] dark:ring-offset-[#151E28]'
                        : 'hover:scale-110 border border-black/10 dark:border-white/10'
                    }`}
                    style={{ backgroundColor: col.value }}
                  />
                ))}

                {/* Custom Color Input */}
                <label
                  title="Custom Color"
                  className="w-5 h-5 rounded-full border border-[#DFD3C0] dark:border-[#2D435A] flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:scale-110 transition-transform"
                  style={{
                    background:
                      'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  }}
                >
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => onChangeColor(e.target.value)}
                    className="opacity-0 w-0 h-0 pointer-events-none"
                  />
                </label>
              </div>
            </>
          )}

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Drawing Undo / Redo / Clear */}
          <button
            onClick={() => {
              triggerHaptic();
              onDrawingUndo();
            }}
            disabled={!canDrawingUndo}
            title="Undo stroke"
            className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 size={15} />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              onDrawingRedo();
            }}
            disabled={!canDrawingRedo}
            title="Redo stroke"
            className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 size={15} />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              onDrawingClear();
            }}
            disabled={!canDrawingUndo}
            title="Clear all annotations on this note"
            className="p-1.5 rounded shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </>
      ) : (
        /* When in Type Mode: Show standard rich text formatting tools */
        <>
          {/* Headings */}
          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
            title="Title (H1)"
            className={getBtnClass(editor.isActive('heading', { level: 1 }))}
          >
            <Heading1 size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            title="Heading (H2)"
            className={getBtnClass(editor.isActive('heading', { level: 2 }))}
          >
            <Heading2 size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
            title="Subheading (H3)"
            className={getBtnClass(editor.isActive('heading', { level: 3 }))}
          >
            <Heading3 size={15} />
          </button>

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Basic Formatting */}
          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleBold().run())}
            title="Bold (Cmd+B)"
            className={getBtnClass(editor.isActive('bold'))}
          >
            <Bold size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleItalic().run())}
            title="Italic (Cmd+I)"
            className={getBtnClass(editor.isActive('italic'))}
          >
            <Italic size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleUnderline().run())}
            title="Underline (Cmd+U)"
            className={getBtnClass(editor.isActive('underline'))}
          >
            <UnderlineIcon size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleStrike().run())}
            title="Strikethrough"
            className={getBtnClass(editor.isActive('strike'))}
          >
            <Strikethrough size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleHighlight().run())}
            title="Highlight Text"
            className={getBtnClass(editor.isActive('highlight'))}
          >
            <TextHighlightIcon size={15} />
          </button>

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Lists */}
          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleTaskList().run())}
            title="Checklist"
            className={getBtnClass(editor.isActive('taskList'))}
          >
            <CheckSquare size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleBulletList().run())}
            title="Bullet List"
            className={getBtnClass(editor.isActive('bulletList'))}
          >
            <List size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleOrderedList().run())}
            title="Numbered List"
            className={getBtnClass(editor.isActive('orderedList'))}
          >
            <ListOrdered size={15} />
          </button>

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Quotes & Code */}
          <button
            onClick={() => runCommand(() => editor.chain().focus().toggleBlockquote().run())}
            title="Blockquote"
            className={getBtnClass(editor.isActive('blockquote'))}
          >
            <Quote size={15} />
          </button>

          <button
            onClick={() => runCommand(() => toggleUnifiedCodeBlock(editor))}
            title="Code Block"
            className={getBtnClass(editor.isActive('codeBlock'))}
          >
            <Code size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().setHorizontalRule().run())}
            title="Horizontal Divider"
            className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] transition-colors"
          >
            <Minus size={15} />
          </button>

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

          {/* Text Undo / Redo */}
          <button
            onClick={() => runCommand(() => editor.chain().focus().undo().run())}
            disabled={!editor.can().undo()}
            title="Undo (Cmd+Z)"
            className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 size={15} />
          </button>

          <button
            onClick={() => runCommand(() => editor.chain().focus().redo().run())}
            disabled={!editor.can().redo()}
            title="Redo (Cmd+Shift+Z)"
            className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 size={15} />
          </button>
        </>
      )}
    </div>
  );
};
