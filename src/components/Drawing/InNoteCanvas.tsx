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

export type DrawingToolType = 'pen' | 'highlighter' | 'partial_eraser' | 'stroke_eraser' | 'eraser';

interface InNoteCanvasProps {
  noteId: string;
  theme?: 'light' | 'dark';
  initialStrokesJson?: string | null;
  isPenMode: boolean;
  activeTool: DrawingToolType;
  activeColor: string;
  activeSize: number;
  onStrokesUpdate: (strokesJson: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  undoTrigger?: number;
  redoTrigger?: number;
  clearTrigger?: number;
}

/**
 * Clean, High-Contrast Cursors matching user reference drawings
 * Theme-aware: bold white outline on dark theme, bold dark outline on light theme
 */
function getPenCursor(theme?: 'light' | 'dark') {
  const isDark = theme === 'dark';
  const stroke = isDark ? '%23FFFFFF' : '%231C2B36';
  const fill = isDark ? '%231E293B' : '%23FFFFFF';
  const tipFill = isDark ? '%237EAAD0' : '%23D97706';
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26' fill='none'%3E%3Cpath d='M2 24 L2 17 L15 4 C17 2 20 2 22 4 C24 6 24 9 22 11 L9 24 Z' fill='${fill}' stroke='${stroke}' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'/%3E%3Cpolygon points='2,24 2,17 9,24' fill='${tipFill}' stroke='${stroke}' stroke-width='1.8' stroke-linejoin='round'/%3E%3Cline x1='12' y1='7' x2='19' y2='14' stroke='${stroke}' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 2 24, crosshair`;
}

function getHighlighterCursor(theme?: 'light' | 'dark') {
  const isDark = theme === 'dark';
  const stroke = isDark ? '%23FFFFFF' : '%231C2B36';
  const fill = isDark ? '%231E293B' : '%23FFFFFF';
  const chiselColor = '%23FACC15';
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26' fill='none'%3E%3Cpath d='M4 17 L16 5 L22 11 L10 23 Z' fill='${fill}' stroke='${stroke}' stroke-width='2.2' stroke-linejoin='round'/%3E%3Cpath d='M4 17 L2 24 L7 22 L10 23 Z' fill='${chiselColor}' stroke='${stroke}' stroke-width='2' stroke-linejoin='round'/%3E%3Cline x1='4' y1='17' x2='10' y2='23' stroke='${stroke}' stroke-width='2'/%3E%3C/svg%3E") 2 24, crosshair`;
}

function getEraserCursor(theme?: 'light' | 'dark') {
  const isDark = theme === 'dark';
  const stroke = isDark ? '%23FFFFFF' : '%231C2B36';
  const fill = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26' fill='none'%3E%3Ccircle cx='13' cy='13' r='10' stroke='${stroke}' stroke-width='2' stroke-dasharray='3 2' fill='${fill}'/%3E%3Ccircle cx='13' cy='13' r='1.5' fill='${stroke}'/%3E%3C/svg%3E") 13 13, crosshair`;
}

/**
 * Erases points inside the eraser circle, splitting the stroke into surviving sub-strokes
 */
function erasePartOfStroke(
  stroke: InNoteStroke,
  ex: number,
  ey: number,
  radius: number
): InNoteStroke[] {
  if (stroke.points.length === 0) return [];
  const r2 = (radius + stroke.size / 2) * (radius + stroke.size / 2);

  // Subdivide any long line segments so fast gestures don't skip lines
  const densePoints: InNotePoint[] = [];
  for (let i = 0; i < stroke.points.length; i++) {
    const curr = stroke.points[i];
    if (i === 0) {
      densePoints.push(curr);
      continue;
    }
    const prev = stroke.points[i - 1];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const step = Math.max(3, radius / 3);
    if (dist > step) {
      const numSteps = Math.floor(dist / step);
      for (let s = 1; s <= numSteps; s++) {
        const t = s / (numSteps + 1);
        densePoints.push({
          x: prev.x + (curr.x - prev.x) * t,
          y: prev.y + (curr.y - prev.y) * t,
          pressure:
            prev.pressure && curr.pressure
              ? prev.pressure + (curr.pressure - prev.pressure) * t
              : prev.pressure,
        });
      }
    }
    densePoints.push(curr);
  }

  const resultingStrokes: InNoteStroke[] = [];
  let currentSegment: InNotePoint[] = [];

  for (const pt of densePoints) {
    const dx = pt.x - ex;
    const dy = pt.y - ey;
    const isInside = dx * dx + dy * dy <= r2;

    if (!isInside) {
      currentSegment.push(pt);
    } else {
      if (currentSegment.length > 0) {
        resultingStrokes.push({
          ...stroke,
          id: `${stroke.id}-${resultingStrokes.length}-${Date.now().toString(36)}`,
          points: currentSegment,
        });
        currentSegment = [];
      }
    }
  }

  if (currentSegment.length > 0) {
    resultingStrokes.push({
      ...stroke,
      id: `${stroke.id}-${resultingStrokes.length}-${Date.now().toString(36)}`,
      points: currentSegment,
    });
  }

  return resultingStrokes;
}

export const InNoteCanvas: React.FC<InNoteCanvasProps> = ({
  noteId,
  theme = 'light',
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
        const dotRadius =
          (stroke.size * (p.pressure && p.pressure > 0 ? p.pressure * 1.2 : 1)) / 2;
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

  // Point-to-segment distance for whole-stroke eraser collision
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

  // 1. Partial Eraser: Erases points inside the eraser circle, splitting strokes cleanly
  const handlePartialEraserAt = (x: number, y: number, radius = 20) => {
    let changed = false;
    const r2 = (radius + 2) * (radius + 2);

    const nextStrokes: InNoteStroke[] = [];

    for (const stroke of strokesRef.current) {
      let strokeHit = false;

      for (const pt of stroke.points) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        if (dx * dx + dy * dy <= r2) {
          strokeHit = true;
          break;
        }
      }

      if (!strokeHit) {
        nextStrokes.push(stroke);
      } else {
        changed = true;
        const parts = erasePartOfStroke(stroke, x, y, radius);
        nextStrokes.push(...parts);
      }
    }

    if (changed) {
      setStrokes(nextStrokes);
      onStrokesUpdate(JSON.stringify(nextStrokes));
    }
  };

  // 2. Stroke Eraser: Deletes the entire stroke object on contact
  const handleStrokeEraserAt = (x: number, y: number, radius = 24) => {
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
      setStrokes(remaining);
      onStrokesUpdate(JSON.stringify(remaining));
    }
  };

  // Route erasing to partial or whole-stroke eraser
  const handleEraserAt = (x: number, y: number, radius: number) => {
    if (activeTool === 'stroke_eraser') {
      handleStrokeEraserAt(x, y, radius);
    } else {
      handlePartialEraserAt(x, y, radius);
    }
  };

  const isEraserTool =
    activeTool === 'partial_eraser' || activeTool === 'stroke_eraser' || activeTool === 'eraser';

  // Stylus & Touch Pointer Event Handlers (Zero continuous vibration on canvas for maximum comfort!)
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

    if (isEraserTool) {
      handleEraserAt(x, y, Math.max(18, activeSize * 2.8));
      return;
    }

    const newStroke: InNoteStroke = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
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

    if (isEraserTool) {
      handleEraserAt(x, y, Math.max(18, activeSize * 2.8));
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

    if (!isEraserTool && currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
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
    if (isEraserTool) return getEraserCursor(theme);
    if (activeTool === 'highlighter') return getHighlighterCursor(theme);
    return getPenCursor(theme);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute top-0 left-0 w-full ${
        isPenMode ? 'z-20 pointer-events-auto' : 'z-10 pointer-events-none'
      }`}
      style={{
        touchAction: 'none',
        cursor: getCursorStyle(),
      }}
    />
  );
};
