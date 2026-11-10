import React, { useRef, useState, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../../utils/haptics';

export interface InNotePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface InNoteStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  points: InNotePoint[];
}

interface InNoteCanvasProps {
  noteId: string;
  initialStrokesJson?: string | null;
  isPenMode: boolean;
  activeTool: 'pen' | 'highlighter' | 'eraser';
  activeColor: string;
  activeSize: number;
  onStrokesUpdate: (strokesJson: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  undoTrigger?: number;
  redoTrigger?: number;
  clearTrigger?: number;
}

// Aesthetic Custom SVG Cursors for Desktop
const PEN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M7 17L18 6l2 2L9 19l-7 3 2-7L7 17z' fill='%23213A50' stroke='%23FAF6EF' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpath d='M2 22l5-2-3-3-2 5z' fill='%23E5A93C' stroke='%23FAF6EF' stroke-width='1'/%3E%3Ccircle cx='2' cy='22' r='1.2' fill='%23DC2626'/%3E%3C/svg%3E") 2 22, crosshair`;

const HIGHLIGHTER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M8 16L18 6l3 3L11 19l-7 2 1-5 3 0z' fill='%23D97706' stroke='%23FAF6EF' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpolygon points='2,22 7,20 5,17 1,19' fill='%23FACC15' stroke='%23FAF6EF' stroke-width='1'/%3E%3Cline x1='2' y1='22' x2='4' y2='19' stroke='%23B45309' stroke-width='1.5'/%3E%3C/svg%3E") 2 22, crosshair`;

const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='9' fill='rgba(239,68,68,0.2)' stroke='%23DC2626' stroke-width='1.5' stroke-dasharray='3 2'/%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%23DC2626'/%3E%3C/svg%3E") 12 12, crosshair`;

export const InNoteCanvas: React.FC<InNoteCanvasProps> = ({
  noteId,
  initialStrokesJson,
  isPenMode,
  activeTool,
  activeColor,
  activeSize,
  onStrokesUpdate,
  onHistoryChange,
  undoTrigger,
  redoTrigger,
  clearTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [strokes, setStrokes] = useState<InNoteStroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<InNoteStroke[]>([]);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<InNoteStroke | null>(null);
  const strokesRef = useRef<InNoteStroke[]>([]);
  strokesRef.current = strokes;

  // Track if active drawing is using a hardware stylus
  const isStylusActiveRef = useRef(false);
  const lastTouchMidYRef = useRef<number | null>(null);

  // Track the noteId that current strokes belong to
  const prevNoteIdRef = useRef<string>(noteId);

  // Notify parent of undo/redo availability
  useEffect(() => {
    onHistoryChange?.(strokes.length > 0, undoneStrokes.length > 0);
  }, [strokes.length, undoneStrokes.length, onHistoryChange]);

  // Load strokes when switching notes or remote sync arrives
  useEffect(() => {
    const isDifferentNote = prevNoteIdRef.current !== noteId;
    prevNoteIdRef.current = noteId;

    if (isDifferentNote) {
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
    } else if (!isDrawingRef.current) {
      // Remote sync or external change while staying on same note
      const currentJson = JSON.stringify(strokesRef.current);
      if (initialStrokesJson && initialStrokesJson !== currentJson) {
        try {
          const parsed = JSON.parse(initialStrokesJson);
          if (Array.isArray(parsed)) {
            setStrokes(parsed);
          }
        } catch (_) {}
      }
    }
  }, [noteId, initialStrokesJson]);

  // Redraw canvas (transparent background so text beneath shows through seamlessly)
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Reset transform & clear completely to transparent
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

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
        ctx.lineWidth = stroke.size * 2.8;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
      }

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const dotRadius = (stroke.size * (p.pressure && p.pressure > 0 ? p.pressure * 1.2 : 1)) / 2;
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, dotRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Smooth Bézier curve interpolation
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;

        if (curr.pressure && curr.pressure > 0 && stroke.tool !== 'highlighter') {
          ctx.lineWidth = Math.max(1.5, stroke.size * (0.45 + curr.pressure * 0.95));
        }

        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // Sync canvas dimensions with parent content wrapper (with Retina/High-DPI)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const scrollH = parent.scrollHeight;
    const dpr = window.devicePixelRatio || 1;

    let maxStrokeY = 0;
    for (const stroke of strokesRef.current) {
      for (const pt of stroke.points) {
        if (pt.y > maxStrokeY) maxStrokeY = pt.y;
      }
    }

    const width = Math.max(300, Math.floor(rect.width));
    // Use maximum of container height, full scroll height, and max stroke Y
    const height = Math.max(500, Math.floor(Math.max(rect.height, scrollH, maxStrokeY + 250)));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      redrawCanvas();
    }
  }, [redrawCanvas]);

  useEffect(() => {
    resizeCanvas();
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });

    resizeObserver.observe(canvas.parentElement);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes, redrawCanvas]);

  // Native non-passive touch listeners on canvas to guarantee zero scrolling during single-finger drawing/highlighting/erasing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isPenMode) return;
      if (e.touches.length === 1) {
        // Prevent default browser touch scrolling on single finger/pen
        e.preventDefault();
      } else if (e.touches.length >= 2) {
        // Multi-touch: user wants to scroll the page with two fingers
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          currentStrokeRef.current = null;
          redrawCanvas();
        }
        lastTouchMidYRef.current = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPenMode) return;
      if (e.touches.length === 1) {
        // Single finger/pen drawing: prevent browser scroll gesture
        e.preventDefault();
      } else if (e.touches.length >= 2) {
        // Two fingers: smooth natural document scroll
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (lastTouchMidYRef.current !== null) {
          const deltaY = currentMidY - lastTouchMidYRef.current;
          const scrollContainer = canvas.closest('.overflow-y-auto') as HTMLElement | null;
          if (scrollContainer) {
            scrollContainer.scrollTop -= deltaY;
          }
        }
        lastTouchMidYRef.current = currentMidY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchMidYRef.current = null;
      }
    };

    const onTouchCancel = () => {
      lastTouchMidYRef.current = null;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [isPenMode, redrawCanvas]);

  // Handle external Undo trigger
  const prevUndoTrigger = useRef(undoTrigger);
  useEffect(() => {
    if (undoTrigger !== undefined && undoTrigger !== prevUndoTrigger.current) {
      prevUndoTrigger.current = undoTrigger;
      if (strokesRef.current.length > 0) {
        triggerHaptic();
        const last = strokesRef.current[strokesRef.current.length - 1];
        const next = strokesRef.current.slice(0, -1);
        setStrokes(next);
        setUndoneStrokes((prev) => [...prev, last]);
        onStrokesUpdate(JSON.stringify(next));
      }
    }
  }, [undoTrigger, onStrokesUpdate]);

  // Handle external Redo trigger
  const prevRedoTrigger = useRef(redoTrigger);
  useEffect(() => {
    if (redoTrigger !== undefined && redoTrigger !== prevRedoTrigger.current) {
      prevRedoTrigger.current = redoTrigger;
      if (undoneStrokes.length > 0) {
        triggerHaptic();
        const nextStroke = undoneStrokes[undoneStrokes.length - 1];
        const next = [...strokesRef.current, nextStroke];
        setUndoneStrokes((prev) => prev.slice(0, -1));
        setStrokes(next);
        onStrokesUpdate(JSON.stringify(next));
      }
    }
  }, [redoTrigger, undoneStrokes, onStrokesUpdate]);

  // Handle external Clear trigger
  const prevClearTrigger = useRef(clearTrigger);
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger !== prevClearTrigger.current) {
      prevClearTrigger.current = clearTrigger;
      if (strokesRef.current.length > 0) {
        triggerHaptic();
        setUndoneStrokes((prev) => [...prev, ...strokesRef.current]);
        setStrokes([]);
        onStrokesUpdate(JSON.stringify([]));
      }
    }
  }, [clearTrigger, onStrokesUpdate]);

  // Point-to-segment distance for eraser collision
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

  // Erase any stroke intersecting with eraser coordinate
  const handleEraserAt = (x: number, y: number, radius = 26) => {
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
      onStrokesUpdate(JSON.stringify(remaining));
    }
  };

  // Stylus & Touch Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const isPen = e.pointerType === 'pen';

    // Palm rejection: If stylus is currently active, ignore secondary touch pointers
    if (!isPen && isStylusActiveRef.current) return;
    if (isPen) {
      isStylusActiveRef.current = true;
    }

    if (!isPen && e.isPrimary === false) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    isDrawingRef.current = true;

    if (activeTool === 'eraser') {
      handleEraserAt(x, y, Math.max(26, activeSize * 3.5));
      return;
    }

    triggerHaptic();
    const newStroke: InNoteStroke = {
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
    if (!isPenMode) return;
    if (!isDrawingRef.current) return;

    const isPen = e.pointerType === 'pen';
    if (!isPen && isStylusActiveRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'eraser') {
      handleEraserAt(x, y, Math.max(26, activeSize * 3.5));
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

    if (activeTool !== 'eraser' && currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const nextStrokes = [...strokesRef.current, currentStrokeRef.current];
      setStrokes(nextStrokes);
      setUndoneStrokes([]);
      currentStrokeRef.current = null;
      onStrokesUpdate(JSON.stringify(nextStrokes));
    }
    redrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      setTimeout(() => {
        isStylusActiveRef.current = false;
      }, 150);
    }
    finishDrawing();
  };

  const handlePointerCancel = () => {
    finishDrawing();
  };

  const getCursorStyle = () => {
    if (!isPenMode) return 'default';
    if (activeTool === 'eraser') return ERASER_CURSOR;
    if (activeTool === 'highlighter') return HIGHLIGHTER_CURSOR;
    return PEN_CURSOR;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute top-0 left-0 w-full ${
        isPenMode
          ? 'z-20 pointer-events-auto'
          : 'z-10 pointer-events-none'
      }`}
      style={{
        touchAction: 'none',
        cursor: getCursorStyle(),
      }}
    />
  );
};
