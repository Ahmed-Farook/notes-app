import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  penColor: string;
  onChangePenColor: (color: string) => void;
  penSize: number;
  onChangePenSize: (size: number) => void;
  highlighterColor: string;
  onChangeHighlighterColor: (color: string) => void;
  highlighterSize: number;
  onChangeHighlighterSize: (size: number) => void;
  eraserSize: number;
  onChangeEraserSize: (size: number) => void;
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
  penColor,
  onChangePenColor,
  penSize,
  onChangePenSize,
  highlighterColor,
  onChangeHighlighterColor,
  highlighterSize,
  onChangeHighlighterSize,
  eraserSize,
  onChangeEraserSize,
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
  const penButtonRef = useRef<HTMLButtonElement>(null);
  const eraserButtonRef = useRef<HTMLButtonElement>(null);
  const penPopoverRef = useRef<HTMLDivElement>(null);
  const eraserPopoverRef = useRef<HTMLDivElement>(null);
  const [penPos, setPenPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [eraserPos, setEraserPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const prevIsTableRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const updatePenPosition = () => {
    const rect = penButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isBottomToolbar = rect.top > window.innerHeight / 2;
    const popoverWidth = 288;
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - popoverWidth - 10));
    if (isBottomToolbar) {
      setPenPos({ bottom: Math.max(8, window.innerHeight - rect.top + 8), left });
    } else {
      setPenPos({ top: Math.max(8, rect.bottom + 8), left });
    }
  };

  const updateEraserPosition = () => {
    const rect = eraserButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isBottomToolbar = rect.top > window.innerHeight / 2;
    const popoverWidth = 256;
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - popoverWidth - 10));
    if (isBottomToolbar) {
      setEraserPos({ bottom: Math.max(8, window.innerHeight - rect.top + 8), left });
    } else {
      setEraserPos({ top: Math.max(8, rect.bottom + 8), left });
    }
  };

  const togglePenPopover = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    triggerHaptic();
    setShowEraserPopover(false);
    if (!isPenActive) {
      onChangeDrawingTool('pen');
      setShowPenPopover(false);
      return;
    }
    if (showPenPopover) {
      setShowPenPopover(false);
    } else {
      updatePenPosition();
      setShowPenPopover(true);
    }
  };

  const toggleEraserPopover = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    triggerHaptic();
    setShowPenPopover(false);
    if (!isEraserActive) {
      onChangeDrawingTool('partial_eraser');
      setShowEraserPopover(false);
      return;
    }
    if (showEraserPopover) {
      setShowEraserPopover(false);
    } else {
      updateEraserPosition();
      setShowEraserPopover(true);
    }
  };

  // Close floating popovers when clicking outside or scrolling
  useEffect(() => {
    if (!showPenPopover && !showEraserPopover) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        showPenPopover &&
        penPopoverRef.current &&
        !penPopoverRef.current.contains(target) &&
        !penButtonRef.current?.contains(target)
      ) {
        setShowPenPopover(false);
      }
      if (
        showEraserPopover &&
        eraserPopoverRef.current &&
        !eraserPopoverRef.current.contains(target) &&
        !eraserButtonRef.current?.contains(target)
      ) {
        setShowEraserPopover(false);
      }
    };

    const handleScrollOrResize = (e: Event) => {
      const target = e.target as Node;
      if (
        (penPopoverRef.current && penPopoverRef.current.contains(target)) ||
        (eraserPopoverRef.current && eraserPopoverRef.current.contains(target))
      ) {
        return;
      }
      setShowPenPopover(false);
      setShowEraserPopover(false);
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
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

  const currentToolColor = activeDrawingTool === 'highlighter' ? highlighterColor : penColor;
  const currentToolSize =
    activeDrawingTool === 'highlighter'
      ? highlighterSize
      : activeDrawingTool === 'pen'
      ? penSize
      : eraserSize;

  return (
    <div
      ref={toolbarScrollRef}
      className="h-11 md:h-10 flex flex-nowrap items-center gap-1 px-2.5 border-t md:border-t-0 md:border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0] dark:bg-[#151E28] md:sticky md:top-0 z-30 select-none text-xs shrink-0 overflow-x-auto no-scrollbar order-last md:order-first"
    >
      {/* 1. Mode Switcher: Type vs Draw */}
      <div className="flex items-center bg-[#E5DCCB]/90 dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-lg p-0.5 shrink-0">
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
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-colors duration-75 outline-none ${
            !isPenMode
              ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-[#E8EEF3]'
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
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition-colors duration-75 outline-none ${
            isPenMode
              ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white'
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
          <div className="relative shrink-0">
            <button
              ref={penButtonRef}
              type="button"
              onClick={togglePenPopover}
              title="Pen (Click to select, click again for color & thickness)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-colors duration-75 outline-none focus:outline-none ${
                isPenActive
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              {activeDrawingTool === 'highlighter' ? <Highlighter size={14} /> : <PenTool size={14} />}
              <span className="hidden sm:inline">
                {activeDrawingTool === 'highlighter' ? 'Highlighter' : 'Pen'}
              </span>
              <div
                className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/40 shadow-xs shrink-0 ml-0.5"
                style={{ backgroundColor: currentToolColor }}
              />
            </button>

            {/* Pen Options Popover */}
            {showPenPopover && penPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={penPopoverRef}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  ...(penPos.bottom !== undefined ? { bottom: `${penPos.bottom}px` } : { top: `${penPos.top}px` }),
                  left: `${penPos.left}px`,
                  zIndex: 9999999,
                  pointerEvents: 'auto',
                }}
                className="bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] rounded-xl shadow-2xl p-3 text-xs w-72 select-none"
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
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-colors duration-75 flex items-center justify-center space-x-1.5 outline-none focus:outline-none ${
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
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-colors duration-75 flex items-center justify-center space-x-1.5 outline-none focus:outline-none ${
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
                  {PRESET_COLORS.map((c) => {
                    const isSelected = currentToolColor.toLowerCase() === c.value.toLowerCase();
                    const isLight = c.value === '#FFFFFF' || c.value === '#FACC15' || c.value === '#F472B6';
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          if (activeDrawingTool === 'highlighter') {
                            onChangeHighlighterColor(c.value);
                          } else {
                            onChangePenColor(c.value);
                          }
                        }}
                        title={c.name}
                        className={`w-7 h-7 rounded-full flex items-center justify-center relative select-none border border-black/20 dark:border-white/30 outline-none focus:outline-none transition-transform duration-75 ${
                          isSelected
                            ? 'ring-2 ring-[#213A50] dark:ring-white ring-offset-2 ring-offset-[#FAF6EF] dark:ring-offset-[#1C2733] scale-110 shadow-md'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                      >
                        {isSelected && (
                          <div
                            className={`w-2.5 h-2.5 rounded-full ring-1 ring-black/20 dark:ring-white/40 shadow-xs ${
                              isLight ? 'bg-[#1C2B36]' : 'bg-white'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px] mb-1.5">
                  Thickness
                </div>
                <div className="flex items-center justify-between gap-1">
                  {STROKE_SIZES.map((sz) => {
                    const isSelected = Math.abs(currentToolSize - sz.value) < 0.8;
                    return (
                      <button
                        key={sz.label}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          if (activeDrawingTool === 'highlighter') {
                            onChangeHighlighterSize(sz.value);
                          } else {
                            onChangePenSize(sz.value);
                          }
                        }}
                        className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-md text-[10px] outline-none focus:outline-none transition-colors duration-75 ${
                          isSelected
                            ? 'border-2 border-[#213A50] dark:border-[#7EAAD0] bg-[#FAF6EF] dark:bg-[#203448] font-bold text-[#213A50] dark:text-[#E8EEF3] shadow-xs'
                            : 'border border-[#DFD3C0] dark:border-[#263747] text-[#6E8092] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1E2D3B]'
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
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Eraser Button (Classic Eraser Icon; click to select, click again for Area vs Stroke & size) */}
          <div className="relative shrink-0">
            <button
              ref={eraserButtonRef}
              type="button"
              onClick={toggleEraserPopover}
              title="Eraser (Click to select, click again for Area vs Stroke & size)"
              className={`flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-colors duration-75 outline-none focus:outline-none ${
                isEraserActive
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white'
                  : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1C2733]'
              }`}
            >
              <Eraser size={14} />
              <span className="hidden sm:inline">
                {activeDrawingTool === 'stroke_eraser' ? 'Stroke Eraser' : 'Eraser'}
              </span>
            </button>

            {/* Eraser Options Popover */}
            {showEraserPopover && eraserPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={eraserPopoverRef}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  ...(eraserPos.bottom !== undefined ? { bottom: `${eraserPos.bottom}px` } : { top: `${eraserPos.top}px` }),
                  left: `${eraserPos.left}px`,
                  zIndex: 9999999,
                  pointerEvents: 'auto',
                }}
                className="bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] rounded-xl shadow-2xl p-3 text-xs w-64 select-none"
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
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-colors duration-75 outline-none focus:outline-none ${
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
                    className={`px-2 py-1.5 rounded-md font-medium text-xs transition-colors duration-75 outline-none focus:outline-none ${
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
                  {ERASER_SIZES.map((sz) => {
                    const isSelected = Math.abs(eraserSize - sz.value) < 0.8;
                    return (
                      <button
                        key={sz.label}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          onChangeEraserSize(sz.value);
                        }}
                        className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-md text-[10px] outline-none focus:outline-none transition-colors duration-75 ${
                          isSelected
                            ? 'border-2 border-[#213A50] dark:border-[#7EAAD0] bg-[#FAF6EF] dark:bg-[#203448] font-bold text-[#213A50] dark:text-[#E8EEF3] shadow-xs'
                            : 'border border-[#DFD3C0] dark:border-[#263747] text-[#6E8092] dark:text-[#8AA0B4] hover:bg-[#EBE2D3] dark:hover:bg-[#1E2D3B]'
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
                    );
                  })}
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
              </div>,
              document.body
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
              if (!editor) return;
              const { from, to, empty } = editor.state.selection;
              if (!empty) {
                const selectedText = editor.state.doc.textBetween(from, to);
                editor.chain().focus().insertContent(`$$${selectedText}$$`).run();
              } else {
                editor.chain().focus().insertContent('$$  $$').setTextSelection(from + 2).run();
              }
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
