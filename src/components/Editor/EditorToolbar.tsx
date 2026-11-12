import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Keyboard,
  PenTool,
  Highlighter,
  Eraser,
  Lasso,
  Hand,
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
import type { DrawingToolType } from '../Drawing/InNoteCanvas';

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

export type DrawingTool = DrawingToolType;

interface EditorToolbarProps {
  editor: Editor | null;
  isVisible: boolean;
  // Samsung Notes Seamless In-Note Drawing State
  isPenMode: boolean;
  onTogglePenMode: (penMode: boolean) => void;
  activeDrawingTool: DrawingTool;
  onChangeDrawingTool: (tool: DrawingTool) => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  activeSize: number;
  onChangeSize: (size: number) => void;
  stylusOnly: boolean;
  onToggleStylusOnly: () => void;
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
  stylusOnly,
  onToggleStylusOnly,
  canDrawingUndo,
  canDrawingRedo,
  onDrawingUndo,
  onDrawingRedo,
  onDrawingClear,
}) => {
  if (!editor || !isVisible) return null;

  const runCommand = (cmd: () => void) => {
    cmd();
  };

  const getBtnClass = (isActive: boolean) =>
    `p-1.5 rounded shrink-0 transition-colors outline-none focus:outline-none focus-visible:outline-none ${
      isActive
        ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
        : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
    }`;

  const isEraser =
    activeDrawingTool === 'partial_eraser' ||
    activeDrawingTool === 'stroke_eraser' ||
    activeDrawingTool === 'eraser';

  return (
    <div className="h-11 md:h-10 flex flex-nowrap items-center gap-1.5 px-2.5 border-t md:border-t-0 md:border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur md:sticky md:top-0 z-30 select-none text-xs shrink-0 order-last md:order-first">
      {/* PINNED LEFT ANCHOR: Mode Switcher [Type | Draw] + [Undo] [Redo] (Always reachable on mobile!) */}
      <div className="flex items-center space-x-1 shrink-0">
        <div className="flex items-center bg-[#E5DCCB]/90 dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-lg p-0.5 shrink-0 shadow-xs">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTogglePenMode(false)}
            title="Type (Keyboard Text Mode)"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-all outline-none focus:outline-none ${
              !isPenMode
                ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-[#E8EEF3] shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
            }`}
          >
            <Keyboard size={13} />
            <span className="hidden xs:inline sm:inline">Type</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTogglePenMode(true)}
            title="Draw (Samsung Notes Stylus & Pen Mode)"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-all outline-none focus:outline-none ${
              isPenMode
                ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
            }`}
          >
            <PenTool size={13} />
            <span className="hidden xs:inline sm:inline">Draw</span>
          </button>
        </div>

        {/* Left Undo / Redo (Always accessible on mobile without scrolling!) */}
        {isPenMode ? (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onDrawingUndo()}
              disabled={!canDrawingUndo}
              title="Undo stroke"
              className="p-1.5 rounded-md shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onDrawingRedo()}
              disabled={!canDrawingRedo}
              title="Redo stroke"
              className="p-1.5 rounded-md shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
            >
              <Redo2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().undo().run())}
              disabled={!editor.can().undo()}
              title="Undo (Cmd+Z)"
              className="p-1.5 rounded-md shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().redo().run())}
              disabled={!editor.can().redo()}
              title="Redo (Cmd+Shift+Z)"
              className="p-1.5 rounded-md shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
            >
              <Redo2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-[#DFD3C0] dark:bg-[#223344] shrink-0" />

      {/* SCROLLABLE MIDDLE/RIGHT STRIP */}
      <div className="flex-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
        {isPenMode ? (
          <>
            {/* Tool selector: Pen, Highlighter, Lasso, Part Eraser, Stroke Eraser */}
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  onChangeDrawingTool('pen');
                }}
                title="Pen (Natural Ink with Stylus Pressure)"
                className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
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
                  onChangeDrawingTool('highlighter');
                }}
                title="Highlighter (Translucent Chisel)"
                className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
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
                  onChangeDrawingTool('lasso');
                }}
                title="Lasso Select (Move, Resize, or Delete Portion of Drawing)"
                className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
                  activeDrawingTool === 'lasso'
                    ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                    : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
                }`}
              >
                <Lasso size={14} />
                <span className="hidden sm:inline">Select</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  onChangeDrawingTool('partial_eraser');
                }}
                title="Part Eraser (Erases part of stroke)"
                className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
                  activeDrawingTool === 'partial_eraser' || activeDrawingTool === 'eraser'
                    ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                    : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
                }`}
              >
                <Eraser size={14} />
                <span className="hidden sm:inline">Part Eraser</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  onChangeDrawingTool('stroke_eraser');
                }}
                title="Stroke Eraser (Erases entire stroke)"
                className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
                  activeDrawingTool === 'stroke_eraser'
                    ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                    : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
                }`}
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Stroke Eraser</span>
              </button>
            </div>

            {/* Stylus-Only / Palm Rejection Lock Toggle */}
            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                onToggleStylusOnly();
              }}
              title={
                stylusOnly
                  ? 'Stylus-Only Mode ON (Hand/Finger drawing blocked — tap to allow finger drawing)'
                  : 'Finger Drawing ON (Tap to lock to S-Pen / Apple Pencil only)'
              }
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all shrink-0 outline-none focus:outline-none ${
                stylusOnly
                  ? 'bg-[#213A50] dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <Hand size={13} className={stylusOnly ? 'opacity-60 line-through' : ''} />
              <span className="hidden lg:inline">{stylusOnly ? 'Stylus Only' : 'Finger On'}</span>
            </button>

            {/* Color Palette (hidden when erasing or lassoing) */}
            {!isEraser && activeDrawingTool !== 'lasso' && (
              <>
                <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />
                <div className="flex items-center space-x-1.5 shrink-0">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChangeColor(col.value)}
                      title={col.name}
                      className={`w-5 h-5 rounded-full transition-transform shrink-0 outline-none focus:outline-none border border-black/10 dark:border-white/15 ${
                        activeColor === col.value
                          ? 'scale-115 ring-2 ring-apple-yellow dark:ring-[#7EAAD0] shadow-xs'
                          : 'hover:scale-105 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col.value }}
                    />
                  ))}

                  {/* Custom Color Input */}
                  <label
                    title="Custom Color"
                    className="w-5 h-5 rounded-full border border-black/10 dark:border-white/15 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:scale-105 transition-transform outline-none focus:outline-none"
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

            {/* Stroke / Pointer Size Selector (Moved to RIGHT side as requested!) */}
            {activeDrawingTool !== 'lasso' && (
              <>
                <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />
                <div className="flex items-center space-x-1 shrink-0 ml-auto">
                  {STROKE_SIZES.map((sz) => (
                    <button
                      key={sz.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChangeSize(sz.value)}
                      title={`${sz.label} (${sz.value}px)`}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all outline-none focus:outline-none ${
                        activeSize === sz.value
                          ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                          : 'bg-[#E5DCCB]/60 dark:bg-[#1A2530] text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB] dark:hover:bg-[#223344]'
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
              </>
            )}

            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

            {/* Clear All */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                triggerHaptic();
                onDrawingClear();
              }}
              disabled={!canDrawingUndo}
              title="Clear all annotations on this note"
              className="p-1.5 rounded shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
            >
              <Trash2 size={15} />
            </button>
          </>
        ) : (
          /* When in Type Mode: Standard rich text formatting tools */
          <>
            {/* Headings */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
              title="Title (H1)"
              className={getBtnClass(editor.isActive('heading', { level: 1 }))}
            >
              <Heading1 size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
              title="Heading (H2)"
              className={getBtnClass(editor.isActive('heading', { level: 2 }))}
            >
              <Heading2 size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
              title="Subheading (H3)"
              className={getBtnClass(editor.isActive('heading', { level: 3 }))}
            >
              <Heading3 size={15} />
            </button>

            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

            {/* Basic Formatting */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleBold().run())}
              title="Bold (Cmd+B)"
              className={getBtnClass(editor.isActive('bold'))}
            >
              <Bold size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleItalic().run())}
              title="Italic (Cmd+I)"
              className={getBtnClass(editor.isActive('italic'))}
            >
              <Italic size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleUnderline().run())}
              title="Underline (Cmd+U)"
              className={getBtnClass(editor.isActive('underline'))}
            >
              <UnderlineIcon size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleStrike().run())}
              title="Strikethrough"
              className={getBtnClass(editor.isActive('strike'))}
            >
              <Strikethrough size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleHighlight().run())}
              title="Highlight Text"
              className={getBtnClass(editor.isActive('highlight'))}
            >
              <TextHighlightIcon size={15} />
            </button>

            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

            {/* Lists */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleTaskList().run())}
              title="Checklist"
              className={getBtnClass(editor.isActive('taskList'))}
            >
              <CheckSquare size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleBulletList().run())}
              title="Bullet List"
              className={getBtnClass(editor.isActive('bulletList'))}
            >
              <List size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleOrderedList().run())}
              title="Numbered List"
              className={getBtnClass(editor.isActive('orderedList'))}
            >
              <ListOrdered size={15} />
            </button>

            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-1 shrink-0" />

            {/* Quotes & Code */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().toggleBlockquote().run())}
              title="Blockquote"
              className={getBtnClass(editor.isActive('blockquote'))}
            >
              <Quote size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => toggleUnifiedCodeBlock(editor))}
              title="Code Block"
              className={getBtnClass(editor.isActive('codeBlock'))}
            >
              <Code size={15} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(() => editor.chain().focus().setHorizontalRule().run())}
              title="Horizontal Divider"
              className="p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] transition-colors outline-none focus:outline-none"
            >
              <Minus size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
