import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, X } from 'lucide-react';
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

export type DrawingToolType =
  | 'pen'
  | 'highlighter'
  | 'partial_eraser'
  | 'stroke_eraser'
  | 'lasso'
  | 'eraser';

interface InNoteCanvasProps {
  noteId: string;
  theme?: 'light' | 'dark';
  initialStrokesJson?: string | null;
  isPenMode: boolean;
  activeTool: DrawingToolType;
  activeColor: string;
  activeSize: number;
  stylusOnly?: boolean;
  onStylusDetected?: () => void;
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

function isPointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getStrokesBounds(strokes: InNoteStroke[], selectedIds: Set<string>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const s of strokes) {
    if (!selectedIds.has(s.id)) continue;
    const pad = Math.max(4, (s.tool === 'highlighter' ? s.size * 2.8 : s.size) / 2);
    for (const p of s.points) {
      if (p.x - pad < minX) minX = p.x - pad;
      if (p.y - pad < minY) minY = p.y - pad;
      if (p.x + pad > maxX) maxX = p.x + pad;
      if (p.y + pad > maxY) maxY = p.y + pad;
      count++;
    }
  }

  if (count === 0) return null;
  const padding = 8;
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(32, maxX - minX + padding * 2),
    height: Math.max(32, maxY - minY + padding * 2),
  };
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
    } else if (currentSegment.length > 0) {
      resultingStrokes.push({
        ...stroke,
        id: `${stroke.id}-${resultingStrokes.length}-${Date.now().toString(36)}`,
        points: currentSegment,
      });
      currentSegment = [];
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
  stylusOnly = false,
  onStylusDetected,
  onStrokesUpdate,
  onHistoryChange,
  undoTrigger,
  redoTrigger,
  clearTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [strokes, setStrokes] = useState<InNoteStroke[]>([]);
  // Snapshot history stacks for reliable Undo/Redo across draw, erase, lasso move/resize/delete
  const [undoStack, setUndoStack] = useState<InNoteStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<InNoteStroke[][]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<InNoteStroke | null>(null);
  const strokesRef = useRef<InNoteStroke[]>([]);
  strokesRef.current = strokes;

  // Snapshot captured when starting an eraser drag or lasso transform so the whole gesture is 1 undo step
  const gestureInitialSnapshotRef = useRef<InNoteStroke[] | null>(null);
  const gestureMutatedRef = useRef(false);

  // Live eraser preview circle coordinates (so mobile & tablet users see exact eraser size!)
  const eraserPreviewRef = useRef<{ x: number; y: number; radius: number } | null>(null);

  // Lasso selection loop points while dragging
  const lassoPointsRef = useRef<InNotePoint[]>([]);

  // Selection move / resize interaction state
  const transformDragRef = useRef<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    origBounds: { x: number; y: number; width: number; height: number };
    origStrokes: InNoteStroke[];
  } | null>(null);

  // Palm rejection & hardware stylus state
  const isStylusActiveRef = useRef(false);
  const activeTouchStartTimeRef = useRef<number>(0);
  const lastTouchMidYRef = useRef<number | null>(null);
  const prevNoteIdRef = useRef<string>(noteId);

  const commitStrokesWithHistory = useCallback(
    (nextStrokes: InNoteStroke[], prevSnapshot: InNoteStroke[]) => {
      setUndoStack((prev) => [...prev.slice(-39), prevSnapshot]);
      setRedoStack([]);
      setStrokes(nextStrokes);
      onStrokesUpdate(JSON.stringify(nextStrokes));
    },
    [onStrokesUpdate]
  );

  // Notify parent of undo/redo availability
  useEffect(() => {
    onHistoryChange?.(undoStack.length > 0, redoStack.length > 0);
  }, [undoStack.length, redoStack.length, onHistoryChange]);

  // Clear lasso selection when leaving lasso tool or pen mode
  useEffect(() => {
    if (!isPenMode || activeTool !== 'lasso') {
      setSelectedStrokeIds(new Set());
      lassoPointsRef.current = [];
      transformDragRef.current = null;
    }
  }, [isPenMode, activeTool]);

  // Load strokes when switching notes or remote sync arrives
  useEffect(() => {
    const isDifferentNote = prevNoteIdRef.current !== noteId;
    prevNoteIdRef.current = noteId;

    if (isDifferentNote) {
      setUndoStack([]);
      setRedoStack([]);
      setSelectedStrokeIds(new Set());
      if (initialStrokesJson) {
        try {
          const parsed = JSON.parse(initialStrokesJson);
          if (Array.isArray(parsed)) {
            setStrokes(parsed);
            return;
          }
        } catch (_) {}
      }
      setStrokes([]);
    } else if (!isDrawingRef.current && !transformDragRef.current) {
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

  // Redraw canvas (transparent background + strokes + lasso + live eraser circle)
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

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

    // Draw live freehand Lasso polygon while dragging
    if (lassoPointsRef.current.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
      for (let i = 1; i < lassoPointsRef.current.length; i++) {
        ctx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
      }
      ctx.closePath();
      ctx.fillStyle =
        theme === 'dark' ? 'rgba(126, 170, 208, 0.12)' : 'rgba(33, 58, 80, 0.08)';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = theme === 'dark' ? '#7EAAD0' : '#213A50';
      ctx.stroke();
      ctx.restore();
    }

    // Draw live Eraser Preview Circle (especially helpful on mobile/touch!)
    const ep = eraserPreviewRef.current;
    if (ep) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        theme === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(33, 58, 80, 0.10)';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle =
        theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(220, 38, 38, 0.85)';
      ctx.stroke();
      ctx.restore();
    }
  }, [theme]);

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

  // Native non-passive touch listeners: prevent scrolling on 1 finger while allowing 2-finger scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isPenMode) return;
      if (e.touches.length === 1) {
        e.preventDefault();
      } else if (e.touches.length >= 2) {
        // Multi-touch: cancel any active drawing stroke (palm/finger) and pan
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          currentStrokeRef.current = null;
          lassoPointsRef.current = [];
          eraserPreviewRef.current = null;
          redrawCanvas();
        }
        lastTouchMidYRef.current = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPenMode) return;
      if (e.touches.length === 1) {
        e.preventDefault();
      } else if (e.touches.length >= 2) {
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
      eraserPreviewRef.current = null;
      redrawCanvas();
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
      if (undoStack.length > 0) {
        const previousSnapshot = undoStack[undoStack.length - 1];
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, strokesRef.current]);
        setStrokes(previousSnapshot);
        setSelectedStrokeIds(new Set());
        onStrokesUpdate(JSON.stringify(previousSnapshot));
      }
    }
  }, [undoTrigger, undoStack, onStrokesUpdate]);

  // Handle external Redo trigger
  const prevRedoTrigger = useRef(redoTrigger);
  useEffect(() => {
    if (redoTrigger !== undefined && redoTrigger !== prevRedoTrigger.current) {
      prevRedoTrigger.current = redoTrigger;
      if (redoStack.length > 0) {
        const nextSnapshot = redoStack[redoStack.length - 1];
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, strokesRef.current]);
        setStrokes(nextSnapshot);
        setSelectedStrokeIds(new Set());
        onStrokesUpdate(JSON.stringify(nextSnapshot));
      }
    }
  }, [redoTrigger, redoStack, onStrokesUpdate]);

  // Handle external Clear trigger
  const prevClearTrigger = useRef(clearTrigger);
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger !== prevClearTrigger.current) {
      prevClearTrigger.current = clearTrigger;
      if (strokesRef.current.length > 0) {
        commitStrokesWithHistory([], strokesRef.current);
        setSelectedStrokeIds(new Set());
      }
    }
  }, [clearTrigger, commitStrokesWithHistory]);

  // Delete currently lasso-selected strokes
  const deleteSelectedStrokes = useCallback(() => {
    if (selectedStrokeIds.size === 0) return;
    triggerHaptic();
    const prevSnapshot = strokesRef.current;
    const remaining = prevSnapshot.filter((s) => !selectedStrokeIds.has(s.id));
    commitStrokesWithHistory(remaining, prevSnapshot);
    setSelectedStrokeIds(new Set());
  }, [selectedStrokeIds, commitStrokesWithHistory]);

  // Support Backspace / Delete keyboard shortcut for lasso selection on desktop
  useEffect(() => {
    if (!isPenMode || selectedStrokeIds.size === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedStrokes();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedStrokeIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPenMode, selectedStrokeIds, deleteSelectedStrokes]);

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

  // Partial Eraser
  const handlePartialEraserAt = (x: number, y: number, radius: number) => {
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
        nextStrokes.push(...erasePartOfStroke(stroke, x, y, radius));
      }
    }

    if (changed) {
      gestureMutatedRef.current = true;
      setStrokes(nextStrokes);
    }
  };

  // Whole Stroke Eraser
  const handleStrokeEraserAt = (x: number, y: number, radius: number) => {
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
      gestureMutatedRef.current = true;
      setStrokes(remaining);
    }
  };

  const isEraserTool =
    activeTool === 'partial_eraser' || activeTool === 'stroke_eraser' || activeTool === 'eraser';
  const getEraserRadius = () => Math.max(16, activeSize * 2.5);

  /**
   * Hardware Palm Rejection Helper:
   * - If pointerType === 'pen', notify parent & allow immediately (and cancel any recent accidental palm touch)
   * - If stylusOnly is enabled and pointerType === 'touch', reject!
   * - If contact width/height indicates a palm (>28px) on touch, reject!
   */
  const shouldAllowPointer = (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
    const isPen = e.pointerType === 'pen';
    const isTouch = e.pointerType === 'touch';

    if (isPen) {
      isStylusActiveRef.current = true;
      onStylusDetected?.();

      // Retrospective palm cancellation: if a touch stroke started within last 180ms, cancel it!
      if (
        isDrawingRef.current &&
        currentStrokeRef.current &&
        Date.now() - activeTouchStartTimeRef.current < 180
      ) {
        currentStrokeRef.current = null;
        isDrawingRef.current = false;
        redrawCanvas();
      }
      return true;
    }

    if (isTouch) {
      if (stylusOnly || isStylusActiveRef.current) return false;
      if (e.isPrimary === false) return false;
      // Reject wide palm / wrist contact geometry on touch digitizers
      if ((e.width && e.width > 28) || (e.height && e.height > 28)) return false;
    }

    return true;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;
    if (!shouldAllowPointer(e)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const isPen = e.pointerType === 'pen';
    if (e.pointerType === 'touch') {
      activeTouchStartTimeRef.current = Date.now();
    }

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    isDrawingRef.current = true;

    if (activeTool === 'lasso') {
      // Starting a new lasso loop clears any prior selection
      setSelectedStrokeIds(new Set());
      lassoPointsRef.current = [{ x, y }];
      redrawCanvas();
      return;
    }

    if (isEraserTool) {
      const r = getEraserRadius();
      eraserPreviewRef.current = { x, y, radius: r };
      gestureInitialSnapshotRef.current = strokesRef.current;
      gestureMutatedRef.current = false;
      if (activeTool === 'stroke_eraser') {
        handleStrokeEraserAt(x, y, r);
      } else {
        handlePartialEraserAt(x, y, r);
      }
      redrawCanvas();
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

    // Even when hovering (e.g. S-Pen approaching screen), detect pen to lock out palm!
    if (e.pointerType === 'pen') {
      isStylusActiveRef.current = true;
      onStylusDetected?.();
    }

    if (!isDrawingRef.current) return;
    if (e.pointerType === 'touch' && (stylusOnly || isStylusActiveRef.current)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isPen = e.pointerType === 'pen';
    const pressure = isPen && e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'lasso') {
      lassoPointsRef.current.push({ x, y });
      redrawCanvas();
      return;
    }

    if (isEraserTool) {
      const r = getEraserRadius();
      eraserPreviewRef.current = { x, y, radius: r };
      if (activeTool === 'stroke_eraser') {
        handleStrokeEraserAt(x, y, r);
      } else {
        handlePartialEraserAt(x, y, r);
      }
      redrawCanvas();
      return;
    }

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y, pressure });
      redrawCanvas();
    }
  };

  const finishDrawing = () => {
    eraserPreviewRef.current = null;
    if (!isDrawingRef.current) {
      redrawCanvas();
      return;
    }
    isDrawingRef.current = false;

    if (activeTool === 'lasso') {
      const poly = lassoPointsRef.current;
      lassoPointsRef.current = [];
      if (poly.length >= 3) {
        const hitIds = new Set<string>();
        for (const stroke of strokesRef.current) {
          for (const pt of stroke.points) {
            if (isPointInPolygon(pt.x, pt.y, poly)) {
              hitIds.add(stroke.id);
              break;
            }
          }
        }
        setSelectedStrokeIds(hitIds);
      } else if (poly.length > 0) {
        // Quick tap on canvas near a stroke selects that single stroke
        const tap = poly[0];
        const hitIds = new Set<string>();
        for (const stroke of strokesRef.current) {
          const hit = stroke.points.some((pt) => Math.hypot(pt.x - tap.x, pt.y - tap.y) <= 18);
          if (hit) hitIds.add(stroke.id);
        }
        setSelectedStrokeIds(hitIds);
      }
      redrawCanvas();
      return;
    }

    if (isEraserTool) {
      if (gestureMutatedRef.current && gestureInitialSnapshotRef.current) {
        commitStrokesWithHistory(strokesRef.current, gestureInitialSnapshotRef.current);
      }
      gestureInitialSnapshotRef.current = null;
      gestureMutatedRef.current = false;
      redrawCanvas();
      return;
    }

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const prevSnapshot = strokesRef.current;
      const nextStrokes = [...prevSnapshot, currentStrokeRef.current];
      currentStrokeRef.current = null;
      commitStrokesWithHistory(nextStrokes, prevSnapshot);
    }
    redrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      setTimeout(() => {
        isStylusActiveRef.current = false;
      }, 250);
    }
    finishDrawing();
  };

  const handlePointerCancel = () => {
    finishDrawing();
  };

  // Interactive Selection Box Move / Resize Handlers
  const selectionBounds = useMemo(() => {
    if (selectedStrokeIds.size === 0) return null;
    return getStrokesBounds(strokes, selectedStrokeIds);
  }, [strokes, selectedStrokeIds]);

  const startTransformDrag = (
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!selectionBounds) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    transformDragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origBounds: { ...selectionBounds },
      origStrokes: strokesRef.current.map((s) => ({
        ...s,
        points: s.points.map((p) => ({ ...p })),
      })),
    };
  };

  const handleTransformMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = transformDragRef.current;
    if (!drag) return;
    e.stopPropagation();

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { origBounds, origStrokes, mode } = drag;

    if (mode === 'move') {
      const updated = origStrokes.map((s) => {
        if (!selectedStrokeIds.has(s.id)) return s;
        return {
          ...s,
          points: s.points.map((p) => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy,
          })),
        };
      });
      setStrokes(updated);
      return;
    }

    // Corner resize anchored at the opposite corner
    const minDim = 24;
    let anchorX = origBounds.x;
    let anchorY = origBounds.y;
    let newWidth = origBounds.width;
    let newHeight = origBounds.height;

    if (mode === 'se') {
      anchorX = origBounds.x;
      anchorY = origBounds.y;
      newWidth = Math.max(minDim, origBounds.width + dx);
      newHeight = Math.max(minDim, origBounds.height + dy);
    } else if (mode === 'nw') {
      anchorX = origBounds.x + origBounds.width;
      anchorY = origBounds.y + origBounds.height;
      newWidth = Math.max(minDim, origBounds.width - dx);
      newHeight = Math.max(minDim, origBounds.height - dy);
    } else if (mode === 'ne') {
      anchorX = origBounds.x;
      anchorY = origBounds.y + origBounds.height;
      newWidth = Math.max(minDim, origBounds.width + dx);
      newHeight = Math.max(minDim, origBounds.height - dy);
    } else if (mode === 'sw') {
      anchorX = origBounds.x + origBounds.width;
      anchorY = origBounds.y;
      newWidth = Math.max(minDim, origBounds.width - dx);
      newHeight = Math.max(minDim, origBounds.height + dy);
    }

    const scaleX = newWidth / origBounds.width;
    const scaleY = newHeight / origBounds.height;
    const sizeScale = Math.sqrt(scaleX * scaleY);

    const updated = origStrokes.map((s) => {
      if (!selectedStrokeIds.has(s.id)) return s;
      return {
        ...s,
        size: Math.max(1.5, Math.min(36, s.size * sizeScale)),
        points: s.points.map((p) => ({
          ...p,
          x: anchorX + (p.x - anchorX) * scaleX,
          y: anchorY + (p.y - anchorY) * scaleY,
        })),
      };
    });
    setStrokes(updated);
  };

  const finishTransformDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = transformDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    transformDragRef.current = null;

    if (
      Math.abs(e.clientX - drag.startX) > 2 ||
      Math.abs(e.clientY - drag.startY) > 2
    ) {
      commitStrokesWithHistory(strokesRef.current, drag.origStrokes);
    }
  };

  const getCursorStyle = () => {
    if (!isPenMode) return 'default';
    if (activeTool === 'lasso') return 'crosshair';
    if (isEraserTool) return getEraserCursor(theme);
    if (activeTool === 'highlighter') return getHighlighterCursor(theme);
    return getPenCursor(theme);
  };

  return (
    <>
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

      {/* Interactive Lasso Selection Box (Move, 4-Corner Resize, Delete) */}
      {isPenMode && activeTool === 'lasso' && selectionBounds && (
        <div
          style={{
            left: `${selectionBounds.x}px`,
            top: `${selectionBounds.y}px`,
            width: `${selectionBounds.width}px`,
            height: `${selectionBounds.height}px`,
            touchAction: 'none',
          }}
          onPointerDown={(e) => startTransformDrag('move', e)}
          onPointerMove={handleTransformMove}
          onPointerUp={finishTransformDrag}
          onPointerCancel={finishTransformDrag}
          className="absolute z-30 border-2 border-dashed border-[#213A50] dark:border-[#7EAAD0] bg-[#213A50]/5 dark:bg-[#7EAAD0]/10 rounded cursor-move select-none"
        >
          {/* Floating Action Pill (Delete / Deselect) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-[#FAF6EF] dark:bg-[#16202A] border border-[#DFD3C0] dark:border-[#263747] rounded-full px-2 py-1 shadow-lg whitespace-nowrap"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteSelectedStrokes();
              }}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete Selected Drawing"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
            <div className="w-px h-3 bg-[#DFD3C0] dark:bg-[#263747]" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStrokeIds(new Set());
              }}
              className="p-0.5 rounded-full text-[#6E7E8E] dark:text-[#8AA0B4] hover:bg-[#E5DCCB] dark:hover:bg-[#223344] transition-colors"
              title="Done"
            >
              <X size={13} />
            </button>
          </div>

          {/* 4 Corner Resize Handles */}
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const posClass =
              corner === 'nw'
                ? '-top-2 -left-2 cursor-nwse-resize'
                : corner === 'ne'
                ? '-top-2 -right-2 cursor-nesw-resize'
                : corner === 'sw'
                ? '-bottom-2 -left-2 cursor-nesw-resize'
                : '-bottom-2 -right-2 cursor-nwse-resize';
            return (
              <div
                key={corner}
                onPointerDown={(e) => startTransformDrag(corner, e)}
                onPointerMove={handleTransformMove}
                onPointerUp={finishTransformDrag}
                onPointerCancel={finishTransformDrag}
                className={`absolute w-4 h-4 rounded-full bg-white dark:bg-[#1E293B] border-2 border-[#213A50] dark:border-[#7EAAD0] shadow-md ${posClass}`}
                style={{ touchAction: 'none' }}
              />
            );
          })}
        </div>
      )}
    </>
  );
};
