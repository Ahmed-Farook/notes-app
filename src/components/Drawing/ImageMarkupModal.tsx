import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Undo2,
  Redo2,
  Trash2,
  PenTool,
  Highlighter,
  Eraser,
  Palette,
  Maximize2,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { InNoteStroke, InNotePoint } from './InNoteCanvas';

interface ImageMarkupModalProps {
  isOpen: boolean;
  imageSrc: string;
  initialStrokesJson?: string | null;
  onClose: () => void;
  onSave: (markedUpImageBase64: string, strokesJson: string) => void;
}

const COLOR_PRESETS = [
  '#E63946', // Vibrant Red
  '#D97706', // Warm Amber
  '#10B981', // Emerald Green
  '#2563EB', // Royal Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#FFFFFF', // White
  '#1C2B36', // Deep Slate
];

const SIZE_PRESETS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 },
  { label: 'Marker', value: 18 },
];

export const ImageMarkupModal: React.FC<ImageMarkupModalProps> = ({
  isOpen,
  imageSrc,
  initialStrokesJson,
  onClose,
  onSave,
}) => {
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#E63946');
  const [size, setSize] = useState<number>(4);
  const [strokes, setStrokes] = useState<InNoteStroke[]>([]);
  const [history, setHistory] = useState<InNoteStroke[][]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<InNoteStroke | null>(null);

  // Initialize strokes from initialStrokesJson
  useEffect(() => {
    if (!isOpen) return;
    if (initialStrokesJson) {
      try {
        const parsed = JSON.parse(initialStrokesJson);
        if (Array.isArray(parsed)) {
          setStrokes(parsed);
          setHistory([parsed]);
          setHistoryStep(0);
          return;
        }
      } catch (_) {}
    }
    setStrokes([]);
    setHistory([[]]);
    setHistoryStep(0);
  }, [isOpen, initialStrokesJson]);

  // Load image to determine natural size and aspect ratio
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Calculate responsive display size inside window
      const maxWidth = Math.min(window.innerWidth * 0.85, 900);
      const maxHeight = Math.min(window.innerHeight * 0.7, 650);

      const ratio = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
      const displayW = Math.round(img.naturalWidth * ratio);
      const displayH = Math.round(img.naturalHeight * ratio);

      setImageSize({
        width: displayW,
        height: displayH,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Redraw canvas whenever strokes change or image size changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / imageSize.width;
    const scaleY = canvas.height / imageSize.height;

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * 2 * scaleX;
      } else if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.size * 3 * scaleX;
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(1, stroke.size * scaleX);
      }

      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x * scaleX, pts[0].y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x * scaleX, prev.y * scaleY, midX * scaleX, midY * scaleY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x * scaleX, last.y * scaleY);
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [strokes, imageSize]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageSize) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const newStroke: InNoteStroke = {
      id: `markup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color,
      size,
      points: [{ x, y, pressure: e.pressure || 0.5 }],
    };

    currentStrokeRef.current = newStroke;
    setStrokes((prev) => [...prev, newStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const stroke = currentStrokeRef.current;
    stroke.points.push({ x, y, pressure: e.pressure || 0.5 });

    setStrokes((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...stroke, points: [...stroke.points] };
      return copy;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    // Push new history state
    setStrokes((current) => {
      const nextHistory = history.slice(0, historyStep + 1);
      nextHistory.push(current);
      setHistory(nextHistory);
      setHistoryStep(nextHistory.length - 1);
      return current;
    });
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyStep > 0) {
      triggerHaptic();
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setStrokes(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      triggerHaptic();
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setStrokes(history[nextStep]);
    }
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    triggerHaptic();
    setStrokes([]);
    const nextHistory = history.slice(0, historyStep + 1);
    nextHistory.push([]);
    setHistory(nextHistory);
    setHistoryStep(nextHistory.length - 1);
  };

  // Save marked up image: composite image + drawings onto full-resolution canvas
  const handleSave = () => {
    triggerHaptic();
    if (!imgRef.current || !imageSize) {
      onClose();
      return;
    }

    const naturalW = imageSize.naturalWidth;
    const naturalH = imageSize.naturalHeight;

    const offscreen = document.createElement('canvas');
    offscreen.width = naturalW;
    offscreen.height = naturalH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      onClose();
      return;
    }

    // 1. Draw base image
    ctx.drawImage(imgRef.current, 0, 0, naturalW, naturalH);

    // 2. Scale factor from preview coordinate space to natural full-res image
    const scale = naturalW / imageSize.width;

    // 3. Draw all strokes
    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size * 2 * scale;
      } else if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.size * 3 * scale;
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(1.5, stroke.size * scale);
      }

      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x * scale, pts[0].y * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x * scale, prev.y * scale, midX * scale, midY * scale);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x * scale, last.y * scale);
        ctx.stroke();
      }

      ctx.restore();
    }

    const annotatedBase64 = offscreen.toDataURL('image/png');
    onSave(annotatedBase64, JSON.stringify(strokes));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#16202A]/90 border-b border-[#2C4054] text-[#E8EEF3]">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Cancel"
          >
            <X size={18} />
          </button>
          <div>
            <h3 className="font-semibold text-sm tracking-tight text-white">Image Markup</h3>
            <p className="text-[11px] text-neutral-400">Draw, highlight & annotate directly on image</p>
          </div>
        </div>

        {/* Undo / Redo / Clear / Done */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Clear all annotations"
          >
            <Trash2 size={16} />
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover text-white font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            <Check size={14} />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Canvas over Image) */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
      >
        {imageSize && (
          <div
            className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10"
            style={{ width: imageSize.width, height: imageSize.height }}
          >
            {/* Background Image */}
            <img
              src={imageSrc}
              alt="Markup base"
              width={imageSize.width}
              height={imageSize.height}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />

            {/* Interactive Drawing Canvas */}
            <canvas
              ref={canvasRef}
              width={imageSize.width}
              height={imageSize.height}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair z-10"
            />
          </div>
        )}
      </div>

      {/* Bottom Floating Markup Toolbar */}
      <div className="p-3 bg-[#16202A]/90 border-t border-[#2C4054] flex flex-wrap items-center justify-center gap-4 text-xs">
        {/* Tool Selector */}
        <div className="flex items-center space-x-1 bg-[#1C2733] p-1 rounded-xl border border-[#2D435A]">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setTool('pen');
            }}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-apple-yellow text-white shadow-xs'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <PenTool size={14} />
            <span>Pen</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setTool('highlighter');
            }}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tool === 'highlighter'
                ? 'bg-apple-yellow text-white shadow-xs'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Highlighter size={14} />
            <span>Highlighter</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setTool('eraser');
            }}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tool === 'eraser'
                ? 'bg-apple-yellow text-white shadow-xs'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Eraser size={14} />
            <span>Eraser</span>
          </button>
        </div>

        {/* Color Presets (Hidden when Eraser selected) */}
        {tool !== 'eraser' && (
          <div className="flex items-center space-x-1.5 bg-[#1C2733] px-2.5 py-1.5 rounded-xl border border-[#2D435A]">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setColor(c);
                }}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full transition-transform border ${
                  color === c ? 'scale-110 ring-2 ring-white border-transparent' : 'border-white/20 hover:scale-105'
                }`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded-full bg-transparent cursor-pointer border-0 p-0 ml-1"
              title="Custom Color"
            />
          </div>
        )}

        {/* Stroke Sizes */}
        <div className="flex items-center space-x-1 bg-[#1C2733] p-1 rounded-xl border border-[#2D435A]">
          {SIZE_PRESETS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                triggerHaptic();
                setSize(s.value);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                size === s.value
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

