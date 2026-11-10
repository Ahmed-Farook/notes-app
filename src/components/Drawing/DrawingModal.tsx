import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  Grid,
  AlignJustify,
  Square,
  Sparkles,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  points: DrawingPoint[];
}

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, strokesJson?: string) => void;
  initialStrokesJson?: string | null;
  theme?: 'light' | 'dark';
}

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

export const DrawingModal: React.FC<DrawingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialStrokesJson,
  theme = 'light',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drawing state
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<DrawingStroke[]>([]);
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState<string>(() =>
    theme === 'dark' ? '#7EAAD0' : '#213A50'
  );
  const [activeSize, setActiveSize] = useState<number>(5);
  const [paperStyle, setPaperStyle] = useState<'plain' | 'ruled' | 'grid'>('plain');
  const [isStylusActive, setIsStylusActive] = useState<boolean>(false);

  // Live stroke refs for smooth pointer tracking
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  strokesRef.current = strokes;

  // Sync color with theme defaults on mount
  useEffect(() => {
    if (activeColor === '#213A50' && theme === 'dark') {
      setActiveColor('#7EAAD0');
    } else if (activeColor === '#7EAAD0' && theme === 'light') {
      setActiveColor('#213A50');
    }
  }, [theme]);

  // Load initial strokes if editing an existing drawing
  useEffect(() => {
    if (isOpen) {
      if (initialStrokesJson) {
        try {
          const parsed = JSON.parse(initialStrokesJson);
          if (Array.isArray(parsed)) {
            setStrokes(parsed);
            setUndoneStrokes([]);
            return;
          }
        } catch (_) {}
      }
      setStrokes([]);
      setUndoneStrokes([]);
    }
  }, [isOpen, initialStrokesJson]);

  // Render canvas paper background (plain, ruled, grid)
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save();
      const isDark = theme === 'dark';

      // Base background color
      ctx.fillStyle = isDark ? '#131B24' : '#FAF6EF';
      ctx.fillRect(0, 0, width, height);

      if (paperStyle === 'ruled') {
        ctx.strokeStyle = isDark ? 'rgba(74, 98, 122, 0.25)' : 'rgba(212, 196, 172, 0.45)';
        ctx.lineWidth = 1;
        const lineSpacing = 28;
        ctx.beginPath();
        for (let y = lineSpacing; y < height; y += lineSpacing) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      } else if (paperStyle === 'grid') {
        ctx.strokeStyle = isDark ? 'rgba(74, 98, 122, 0.2)' : 'rgba(212, 196, 172, 0.35)';
        ctx.lineWidth = 0.8;
        const gridSize = 24;
        ctx.beginPath();
        for (let x = gridSize; x < width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = gridSize; y < height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }

      ctx.restore();
    },
    [theme, paperStyle]
  );

  // Redraw all strokes onto canvas with smooth curves and pressure sensitivity
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Apply High-DPI scale
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;

    drawBackground(ctx, logicalWidth, logicalHeight);

    const allStrokes = currentStrokeRef.current
      ? [...strokesRef.current, currentStrokeRef.current]
      : strokesRef.current;

    for (const stroke of allStrokes) {
      if (stroke.points.length === 0) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * 2.6;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
      }

      if (stroke.points.length === 1) {
        // Single dot tap
        const p = stroke.points[0];
        const dotRadius = (stroke.size * (p.pressure && p.pressure > 0 ? p.pressure * 1.2 : 1)) / 2;
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, dotRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Smooth Bézier curve across points
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;

        // If pressure sensitivity is available from a stylus / S-Pen / Apple Pencil
        if (curr.pressure && curr.pressure > 0 && stroke.tool !== 'highlighter') {
          ctx.lineWidth = Math.max(
            1.5,
            stroke.size * (0.45 + curr.pressure * 0.95)
          );
        }

        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }
  }, [drawBackground]);

  // Adjust canvas pixel dimensions to match display container with retina DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Minimum sensible drawing dimensions
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(300, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      redrawCanvas();
    }
  }, [redrawCanvas]);

  useEffect(() => {
    if (isOpen) {
      // Small tick to ensure layout container has rendered
      const timer = setTimeout(() => {
        resizeCanvas();
      }, 50);

      window.addEventListener('resize', resizeCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [isOpen, resizeCanvas]);

  useEffect(() => {
    if (isOpen) {
      redrawCanvas();
    }
  }, [isOpen, strokes, paperStyle, theme, redrawCanvas]);

  // Point distance helper for eraser collision
  const distanceToSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  // Erase any stroke intersecting with eraser position
  const handleEraserAt = (x: number, y: number, radius = 16) => {
    const remaining = strokesRef.current.filter((stroke) => {
      for (let i = 0; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        if (Math.hypot(pt.x - x, pt.y - y) <= radius + stroke.size) {
          return false;
        }
        if (i > 0) {
          const prev = stroke.points[i - 1];
          if (distanceToSegment(x, y, prev.x, prev.y, pt.x, pt.y) <= radius + stroke.size) {
            return false;
          }
        }
      }
      return true;
    });

    if (remaining.length !== strokesRef.current.length) {
      triggerHaptic();
      setStrokes(remaining);
    }
  };

  // Stylus & Touch Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection: ignore secondary touch points
    if (e.isPrimary === false) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect stylus / S-Pen / Apple Pencil
    const isPen = e.pointerType === 'pen';
    setIsStylusActive(isPen);

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    isDrawingRef.current = true;

    if (activeTool === 'eraser') {
      handleEraserAt(x, y, activeSize * 2.5);
      return;
    }

    triggerHaptic();
    const newStroke: DrawingStroke = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: [{ x, y, pressure }],
    };

    currentStrokeRef.current = newStroke;
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isPen = e.pointerType === 'pen';
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'eraser') {
      handleEraserAt(x, y, activeSize * 2.5);
      return;
    }

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y, pressure });
      redrawCanvas();
    }
  };

  const finishDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      setStrokes((prev) => [...prev, currentStrokeRef.current!]);
      setUndoneStrokes([]);
      currentStrokeRef.current = null;
    }
    redrawCanvas();
  };

  const handlePointerUp = () => {
    finishDrawing();
  };

  const handlePointerCancel = () => {
    finishDrawing();
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    triggerHaptic();
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setUndoneStrokes((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (undoneStrokes.length === 0) return;
    triggerHaptic();
    const next = undoneStrokes[undoneStrokes.length - 1];
    setUndoneStrokes((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, next]);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    triggerHaptic();
    setUndoneStrokes((prev) => [...prev, ...strokes]);
    setStrokes([]);
  };

  // Export finished drawing to clean high-res PNG and save into note
  const handleSaveAndInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) {
      onClose();
      return;
    }

    triggerHaptic();

    // Create export canvas with tight bounding box or clean scaled output
    const exportCanvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    if (expCtx) {
      expCtx.setTransform(1, 0, 0, 1, 0, 0);
      expCtx.scale(dpr, dpr);
      drawBackground(expCtx, width, height);

      // Replay all strokes
      for (const stroke of strokes) {
        if (stroke.points.length === 0) continue;
        expCtx.save();
        expCtx.lineCap = 'round';
        expCtx.lineJoin = 'round';

        if (stroke.tool === 'highlighter') {
          expCtx.globalAlpha = 0.38;
          expCtx.strokeStyle = stroke.color;
          expCtx.lineWidth = stroke.size * 2.6;
        } else {
          expCtx.globalAlpha = 1.0;
          expCtx.strokeStyle = stroke.color;
          expCtx.lineWidth = stroke.size;
        }

        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          expCtx.fillStyle = stroke.color;
          expCtx.beginPath();
          expCtx.arc(p.x, p.y, Math.max(1.5, stroke.size / 2), 0, Math.PI * 2);
          expCtx.fill();
          expCtx.restore();
          continue;
        }

        expCtx.beginPath();
        expCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const prev = stroke.points[i - 1];
          const curr = stroke.points[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          if (curr.pressure && curr.pressure > 0 && stroke.tool !== 'highlighter') {
            expCtx.lineWidth = Math.max(1.5, stroke.size * (0.45 + curr.pressure * 0.95));
          }
          expCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        expCtx.lineTo(last.x, last.y);
        expCtx.stroke();
        expCtx.restore();
      }
    }

    const dataUrl = exportCanvas.toDataURL('image/png', 0.95);
    const strokesJson = JSON.stringify(strokes);

    onSave(dataUrl, strokesJson);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      {/* Drawing Header */}
      <div className="h-12 border-b border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur px-3 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            title="Cancel"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-[#8AA0B4] dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-sm text-[#1C2B36] dark:text-[#E8EEF3]">
              Draw &amp; Annotate
            </span>
            {isStylusActive && (
              <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                <Sparkles size={11} />
                <span>Stylus / S-Pen Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Paper style selector & Undo/Redo */}
        <div className="flex items-center space-x-1">
          {/* Paper style switch */}
          <div className="flex items-center bg-[#E5DCCB] dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-lg p-0.5 mr-1">
            <button
              onClick={() => {
                triggerHaptic();
                setPaperStyle('plain');
              }}
              title="Plain Paper"
              className={`p-1 rounded ${
                paperStyle === 'plain'
                  ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-white shadow-xs'
                  : 'text-[#6E7E8E] dark:text-[#8AA0B4]'
              }`}
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => {
                triggerHaptic();
                setPaperStyle('ruled');
              }}
              title="Ruled Notebook Lines"
              className={`p-1 rounded ${
                paperStyle === 'ruled'
                  ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-white shadow-xs'
                  : 'text-[#6E7E8E] dark:text-[#8AA0B4]'
              }`}
            >
              <AlignJustify size={13} />
            </button>
            <button
              onClick={() => {
                triggerHaptic();
                setPaperStyle('grid');
              }}
              title="Grid / Math Paper"
              className={`p-1 rounded ${
                paperStyle === 'grid'
                  ? 'bg-[#FAF6EF] dark:bg-[#25394C] text-[#213A50] dark:text-white shadow-xs'
                  : 'text-[#6E7E8E] dark:text-[#8AA0B4]'
              }`}
            >
              <Grid size={13} />
            </button>
          </div>

          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            title="Undo"
            className="p-1.5 rounded-lg text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={undoneStrokes.length === 0}
            title="Redo"
            className="p-1.5 rounded-lg text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB] dark:hover:bg-[#1C2733] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            title="Clear Canvas"
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={handleSaveAndInsert}
            className="ml-2 flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-apple-yellow dark:bg-[#2C4A68] hover:bg-apple-yellowHover dark:hover:bg-[#35587C] text-white font-semibold shadow-xs active:scale-95 transition-all"
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Insert</span>
          </button>
        </div>
      </div>

      {/* Main Drawing Canvas Container with palm rejection (touch-action: none) */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4 touch-none"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="rounded-2xl shadow-xl cursor-crosshair border border-[#DFD3C0] dark:border-[#223344] touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Samsung Notes style floating dock toolbar at bottom */}
      <div className="border-t border-apple-border dark:border-apple-borderDark bg-[#F2ECE0]/95 dark:bg-[#151E28]/95 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
        {/* Tool selector: Pen, Highlighter, Eraser */}
        <div className="flex items-center space-x-1.5 bg-[#E5DCCB]/80 dark:bg-[#1A2530] border border-[#DFD3C0] dark:border-[#263747] rounded-xl p-1">
          <button
            onClick={() => {
              triggerHaptic();
              setActiveTool('pen');
            }}
            title="Pen (Natural Ink with Stylus Pressure)"
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTool === 'pen'
                ? 'bg-apple-yellow dark:bg-[#253D56] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
            }`}
          >
            <PenTool size={15} />
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setActiveTool('highlighter');
            }}
            title="Highlighter (Translucent Chisel)"
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTool === 'highlighter'
                ? 'bg-apple-yellow dark:bg-[#253D56] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
            }`}
          >
            <Highlighter size={15} />
            <span className="hidden sm:inline">Highlighter</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setActiveTool('eraser');
            }}
            title="Eraser (Tap or Drag to erase strokes)"
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTool === 'eraser'
                ? 'bg-apple-yellow dark:bg-[#253D56] text-white shadow-xs'
                : 'text-[#5A6D7E] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white'
            }`}
          >
            <Eraser size={15} />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Stroke Size Selector */}
        <div className="flex items-center space-x-1">
          {STROKE_SIZES.map((sz) => (
            <button
              key={sz.label}
              onClick={() => {
                triggerHaptic();
                setActiveSize(sz.value);
              }}
              title={`${sz.label} (${sz.value}px)`}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                activeSize === sz.value
                  ? 'bg-apple-yellow dark:bg-[#2C4A68] text-white ring-2 ring-apple-yellow/40 dark:ring-[#7EAAD0]/50'
                  : 'bg-[#E5DCCB]/60 dark:bg-[#1A2530] text-[#5A6D7E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB]'
              }`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: `${Math.min(14, sz.value + 2)}px`, height: `${Math.min(14, sz.value + 2)}px` }}
              />
            </button>
          ))}
        </div>

        {/* Color Palette (hidden when eraser is active) */}
        {activeTool !== 'eraser' && (
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            {PRESET_COLORS.map((col) => (
              <button
                key={col.value}
                onClick={() => {
                  triggerHaptic();
                  setActiveColor(col.value);
                }}
                title={col.name}
                className={`w-6 h-6 rounded-full transition-transform shrink-0 ${
                  activeColor === col.value
                    ? 'scale-125 ring-2 ring-offset-2 ring-apple-yellow dark:ring-[#7EAAD0] dark:ring-offset-[#151E28]'
                    : 'hover:scale-110 border border-black/10 dark:border-white/10'
                }`}
                style={{ backgroundColor: col.value }}
              />
            ))}

            {/* Custom Color Input */}
            <label
              title="Custom Color"
              className="w-6 h-6 rounded-full border border-[#DFD3C0] dark:border-[#2D435A] flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:scale-110 transition-transform"
              style={{
                background:
                  'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              }}
            >
              <input
                type="color"
                value={activeColor}
                onChange={(e) => setActiveColor(e.target.value)}
                className="opacity-0 w-0 h-0 pointer-events-none"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
