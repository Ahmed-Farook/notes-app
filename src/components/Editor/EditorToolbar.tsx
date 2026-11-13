import React, { useRef, useState, useEffect } from 'react';
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
  Table as TableIcon,
  ImagePlus,
  Sigma,
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

const ERASER_SIZES = [
  { label: 'Fine', value: 4 },
  { label: 'Medium', value: 8 },
  { label: 'Large', value: 14 },
  { label: 'Broad', value: 24 },
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
  const [showPenPopover, setShowPenPopover] = useState(false);
  const [showEraserPopover, setShowEraserPopover] = useState(false);
  const penContainerRef = useRef<HTMLDivElement>(null);
  const eraserContainerRef = useRef<HTMLDivElement>(null);
  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const prevIsTableRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Close floating popovers when clicking outside
  useEffect(() => {
    if (!showPenPopover && !showEraserPopover) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        showPenPopover &&
        penContainerRef.current &&
        !penContainerRef.current.contains(target)
      ) {
        setShowPenPopover(false);
      }
      if (
        showEraserPopover &&
        eraserContainerRef.current &&
        !eraserContainerRef.current.contains(target)
      ) {
        setShowEraserPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPenPopover, showEraserPopover]);

  // When cursor enters a table, smoothly scroll toolbar to end so table controls are instantly visible
  useEffect(() => {
    const isTable = Boolean(editor?.isActive('table'));
    if (isTable && !prevIsTableRef.current) {
      if (toolbarScrollRef.current) {
        toolbarScrollRef.current.scrollTo({
          left: toolbarScrollRef.current.scrollWidth,
          behavior: 'smooth',
        });
      }
    }
    prevIsTableRef.current = isTable;
  }, [editor?.isActive('table')]);

  if (!editor || !isVisible) return null;

  const runCommand = (cmd: () => void) => {
    cmd();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic();
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDim = 1400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.88);
            editor.chain().focus().setImage({ src: compressed }).run();
            return;
          }
        }
        editor.chain().focus().setImage({ src: rawDataUrl }).run();
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getBtnClass = (isActive: boolean) =>
    `p-1.5 rounded shrink-0 transition-colors outline-none focus:outline-none focus-visible:outline-none ${
      isActive
        ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
        : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
    }`;

  const isEraserActive =
    activeDrawingTool === 'partial_eraser' ||
    activeDrawingTool === 'stroke_eraser' ||
    activeDrawingTool === 'eraser';

  const isPenActive = activeDrawingTool === 'pen' || activeDrawingTool === 'highlighter';

  return (
    <div
      ref={toolbarScrollRef}
      className="h-11 md:h-10 flex flex-nowrap items-center gap-1 px-2.5 border-t md:border-t-0 md:border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur md:sticky md:top-0 z-30 select-none text-xs shrink-0 overflow-x-auto no-scrollbar order-last md:order-first"
    >
      {/* 1. Mode Switcher: Type vs Draw */}
      <div className="flex items-center bg-[#E5DCCB]/90 dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-lg p-0.5 shrink-0 shadow-xs">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            triggerHaptic();
            setShowPenPopover(false);
            setShowEraserPopover(false);
            onTogglePenMode(false);
          }}
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
          onClick={() => {
            triggerHaptic();
            onTogglePenMode(true);
          }}
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

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] shrink-0 mx-0.5" />

      {/* 2. Undo & Redo (Positioned immediately after Type & Draw) */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          triggerHaptic();
          if (isPenMode) onDrawingUndo();
          else editor.chain().focus().undo().run();
        }}
        disabled={isPenMode ? !canDrawingUndo : !editor.can().undo()}
        title="Undo"
        className="p-1.5 rounded shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
      >
        <Undo2 size={15} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          triggerHaptic();
          if (isPenMode) onDrawingRedo();
          else editor.chain().focus().redo().run();
        }}
        disabled={isPenMode ? !canDrawingRedo : !editor.can().redo()}
        title="Redo"
        className="p-1.5 rounded shrink-0 text-[#213A50] dark:text-[#CBD8E3] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors outline-none focus:outline-none"
      >
        <Redo2 size={15} />
      </button>

      <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] shrink-0 mx-0.5" />

      {/* 3. DRAWING MODE TOOLS (Samsung Notes Style with Double-Tap / 2nd-Click Popovers) */}
      {isPenMode ? (
        <>
          {/* Pen Button (Click to select, click again for color & thickness options) */}
          <div ref={penContainerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setShowEraserPopover(false);
                if (!isPenActive) {
                  onChangeDrawingTool('pen');
                } else {
                  setShowPenPopover((prev) => !prev);
                }
              }}
              title="Pen (Click to select, click again for color & thickness)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
                isPenActive
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              {activeDrawingTool === 'highlighter' ? <Highlighter size={14} /> : <PenTool size={14} />}
              <span className="hidden sm:inline">
                {activeDrawingTool === 'highlighter' ? 'Highlighter' : 'Pen'}
              </span>
              <div
                className="w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/20 shrink-0 ml-0.5"
                style={{ backgroundColor: activeColor }}
              />
            </button>

            {/* Pen Options Popover */}
            {showPenPopover && (
              <div
                className="absolute left-0 top-full mt-2 bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] rounded-xl shadow-2xl p-3 z-50 text-xs w-72 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-2">
                  Drawing Tool
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-[#EFE8DA] dark:bg-[#151E28] rounded-lg mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onChangeDrawingTool('pen');
                    }}
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      activeDrawingTool === 'pen'
                        ? 'bg-white dark:bg-[#2C4A68] text-[#213A50] dark:text-white shadow-xs font-semibold'
                        : 'text-[#6E8092] dark:text-[#8AA0B4]'
                    }`}
                  >
                    <PenTool size={13} />
                    <span>Pen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onChangeDrawingTool('highlighter');
                    }}
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      activeDrawingTool === 'highlighter'
                        ? 'bg-white dark:bg-[#2C4A68] text-[#213A50] dark:text-white shadow-xs font-semibold'
                        : 'text-[#6E8092] dark:text-[#8AA0B4]'
                    }`}
                  >
                    <Highlighter size={13} />
                    <span>Highlighter</span>
                  </button>
                </div>

                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-1.5">
                  Ink Color
                </div>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        onChangeColor(c.value);
                      }}
                      title={c.name}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        activeColor.toLowerCase() === c.value.toLowerCase()
                          ? 'ring-2 ring-apple-yellow dark:ring-[#7EAAD0] ring-offset-2 scale-110 shadow-xs'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                    >
                      {c.value === '#FFFFFF' && (
                        <div className="w-full h-full rounded-full border border-neutral-300 dark:border-neutral-600" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-1.5">
                  Thickness
                </div>
                <div className="flex items-center justify-between gap-1">
                  {STROKE_SIZES.map((sz) => (
                    <button
                      key={sz.label}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        onChangeSize(sz.value);
                      }}
                      className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-md border text-[10px] transition-all ${
                        activeSize === sz.value
                          ? 'border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellow/10 dark:bg-[#2C4A68]/30 font-bold text-[#213A50] dark:text-white'
                          : 'border-[#DFD3C0] dark:border-[#263747] text-[#6E8092] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1E2D3B]'
                      }`}
                    >
                      <div
                        className="rounded-full bg-current mb-1"
                        style={{
                          width: `${Math.min(14, sz.value + 2)}px`,
                          height: `${Math.min(14, sz.value + 2)}px`,
                        }}
                      />
                      <span>{sz.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Eraser Button (Classic Eraser Icon; click to select, click again for Area vs Stroke & size) */}
          <div ref={eraserContainerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setShowPenPopover(false);
                if (!isEraserActive) {
                  onChangeDrawingTool('partial_eraser');
                } else {
                  setShowEraserPopover((prev) => !prev);
                }
              }}
              title="Eraser (Click to select, click again for Area vs Stroke & size)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all outline-none focus:outline-none ${
                isEraserActive
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <Eraser size={14} />
              <span className="hidden sm:inline">
                {activeDrawingTool === 'stroke_eraser' ? 'Stroke Eraser' : 'Eraser'}
              </span>
            </button>

            {/* Eraser Options Popover */}
            {showEraserPopover && (
              <div
                className="absolute left-0 top-full mt-2 bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] rounded-xl shadow-2xl p-3 z-50 text-xs w-64 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-2">
                  Eraser Type
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-[#EFE8DA] dark:bg-[#151E28] rounded-lg mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onChangeDrawingTool('partial_eraser');
                    }}
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-all ${
                      activeDrawingTool === 'partial_eraser' || activeDrawingTool === 'eraser'
                        ? 'bg-white dark:bg-[#2C4A68] text-[#213A50] dark:text-white shadow-xs font-semibold'
                        : 'text-[#6E8092] dark:text-[#8AA0B4]'
                    }`}
                  >
                    Area Eraser
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onChangeDrawingTool('stroke_eraser');
                    }}
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-all ${
                      activeDrawingTool === 'stroke_eraser'
                        ? 'bg-white dark:bg-[#2C4A68] text-[#213A50] dark:text-white shadow-xs font-semibold'
                        : 'text-[#6E8092] dark:text-[#8AA0B4]'
                    }`}
                  >
                    Stroke Eraser
                  </button>
                </div>

                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-1.5">
                  Eraser Size
                </div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  {ERASER_SIZES.map((sz) => (
                    <button
                      key={sz.label}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        onChangeSize(sz.value);
                      }}
                      className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-md border text-[10px] transition-all ${
                        activeSize === sz.value
                          ? 'border-apple-yellow dark:border-[#7EAAD0] bg-apple-yellow/10 dark:bg-[#2C4A68]/30 font-bold text-[#213A50] dark:text-white'
                          : 'border-[#DFD3C0] dark:border-[#263747] text-[#6E8092] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1E2D3B]'
                      }`}
                    >
                      <div
                        className="rounded-full bg-current mb-1"
                        style={{
                          width: `${Math.min(14, sz.value + 4)}px`,
                          height: `${Math.min(14, sz.value + 4)}px`,
                        }}
                      />
                      <span>{sz.label}</span>
                    </button>
                  ))}
                </div>

                <div className="h-px bg-[#DFD3C0] dark:bg-[#263747] my-2" />

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    onDrawingClear();
                    setShowEraserPopover(false);
                  }}
                  disabled={!canDrawingUndo}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:pointer-events-none font-medium transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Clear All Drawings</span>
                </button>
              </div>
            )}
          </div>

          {/* Lasso / Selection Tool */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              triggerHaptic();
              setShowPenPopover(false);
              setShowEraserPopover(false);
              onChangeDrawingTool('lasso');
            }}
            title="Lasso Select (Move, Resize, or Delete Portion of Drawing)"
            className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all shrink-0 outline-none focus:outline-none ${
              activeDrawingTool === 'lasso'
                ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
            }`}
          >
            <Lasso size={14} />
            <span className="hidden sm:inline">Select</span>
          </button>

          {/* Stylus-Only / Palm Rejection Lock Toggle */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              triggerHaptic();
              onToggleStylusOnly();
            }}
            title={
              stylusOnly
                ? 'Stylus-Only Mode ON (Hand drawing blocked)'
                : 'Finger Drawing ON (Tap to lock to S-Pen / Apple Pencil only)'
            }
            className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-all shrink-0 outline-none focus:outline-none ${
              stylusOnly
                ? 'bg-[#213A50] dark:bg-[#2C4A68] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
            }`}
          >
            <Hand size={14} />
            <span className="hidden sm:inline">Stylus Only</span>
          </button>
        </>
      ) : (
        /* 4. TYPE MODE RICH TEXT TOOLS */
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

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

          {/* Basic Formatting */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand(() => editor.chain().focus().toggleBold().run())}
            title="Bold"
            className={getBtnClass(editor.isActive('bold'))}
          >
            <Bold size={15} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand(() => editor.chain().focus().toggleItalic().run())}
            title="Italic"
            className={getBtnClass(editor.isActive('italic'))}
          >
            <Italic size={15} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand(() => editor.chain().focus().toggleUnderline().run())}
            title="Underline"
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

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

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

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

          {/* Quotes & Code & Divider */}
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

          <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#223344] mx-0.5 shrink-0" />

          {/* Photo / Image Insertion */}
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerHaptic();
              imageInputRef.current?.click();
            }}
            title="Add Photo / Image"
            className="flex items-center space-x-1 p-1.5 rounded shrink-0 text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3] transition-colors outline-none focus:outline-none"
          >
            <ImagePlus size={15} />
            <span className="hidden sm:inline">Photo</span>
          </button>

          {/* Table Insertion & Management */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerHaptic();
              if (editor.isActive('table')) {
                editor.chain().focus().deleteTable().run();
              } else {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              }
            }}
            title={editor.isActive('table') ? 'Delete Table' : 'Insert Table (3x3)'}
            className={`flex items-center space-x-1 p-1.5 rounded shrink-0 transition-colors outline-none focus:outline-none ${
              editor.isActive('table')
                ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
            }`}
          >
            <TableIcon size={15} />
            <span className="hidden sm:inline">Table</span>
          </button>

          {/* Math Formula Insertion */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerHaptic();
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'mathBlock',
                  attrs: {
                    latex:
                      '\\frac{\\partial L}{\\partial w_3} = \\delta_2 \\times x_1 = (-0.00435)(1) = \\mathbf{-0.00435}',
                  },
                })
                .run();
            }}
            title="Insert Math Equation ($$...$$)"
            className={`flex items-center space-x-1 p-1.5 rounded shrink-0 transition-colors outline-none focus:outline-none ${
              editor.isActive('mathBlock')
                ? 'bg-[#E5DCCB] dark:bg-[#203448] text-[#213A50] dark:text-[#7EAAD0] font-bold shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733] hover:text-[#213A50] dark:hover:text-[#E8EEF3]'
            }`}
          >
            <Sigma size={15} />
            <span className="hidden sm:inline">Math</span>
          </button>

          {/* Contextual Table Controls (visible whenever cursor is inside a table) */}
          {editor.isActive('table') && (
            <div className="flex items-center space-x-1 bg-[#FAF6EF] dark:bg-[#1C2733] p-0.5 rounded-md border border-[#DFD3C0] dark:border-[#263747] shadow-xs shrink-0 animate-in fade-in duration-150">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(() => editor.chain().focus().addRowAfter().run())}
                title="Add Row Below"
                className="px-2 py-1 rounded text-[11px] font-semibold text-[#213A50] dark:text-[#7EAAD0] hover:bg-[#EBE2D3] dark:hover:bg-[#263747]"
              >
                + Row
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(() => editor.chain().focus().deleteRow().run())}
                title="Delete Row"
                className="px-2 py-1 rounded text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                - Row
              </button>
              <div className="h-3 w-px bg-[#DFD3C0] dark:bg-[#263747] mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(() => editor.chain().focus().addColumnAfter().run())}
                title="Add Column Right"
                className="px-2 py-1 rounded text-[11px] font-semibold text-[#213A50] dark:text-[#7EAAD0] hover:bg-[#EBE2D3] dark:hover:bg-[#263747]"
              >
                + Col
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(() => editor.chain().focus().deleteColumn().run())}
                title="Delete Column"
                className="px-2 py-1 rounded text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                - Col
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
