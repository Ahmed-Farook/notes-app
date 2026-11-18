import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Copy,
  Check,
  Printer,
  Sun,
  Moon,
  ExternalLink,
  Lock,
  Sparkles,
  Share2,
  AlertCircle,
} from 'lucide-react';
import katex from 'katex';
import { TexoLogo } from '../common/TexoLogo';

interface SharedNoteViewProps {
  payloadStr: string;
  onExit: () => void;
}

interface SharedPayload {
  title: string;
  content: string;
  strokes?: string;
  date?: string;
}

export const SharedNoteView: React.FC<SharedNoteViewProps> = ({ payloadStr, onExit }) => {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Parse payload with rock-solid decoding
  const noteData = useMemo<SharedPayload | null>(() => {
    if (!payloadStr) return null;
    try {
      let str = payloadStr;
      try {
        str = decodeURIComponent(payloadStr);
      } catch (_) {}

      // In URL query parameters, '+' gets converted to space ' '; restore them:
      const cleanBase64 = str.replace(/ /g, '+');

      try {
        const jsonStr = decodeURIComponent(escape(atob(cleanBase64)));
        return JSON.parse(jsonStr);
      } catch (_) {
        try {
          return JSON.parse(atob(cleanBase64));
        } catch (_) {
          return JSON.parse(str);
        }
      }
    } catch (err) {
      console.warn('Failed to parse shared note payload:', err);
      return null;
    }
  }, [payloadStr]);

  // Sync theme with document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Render KaTeX math blocks and code block styles in the note content
  useEffect(() => {
    if (!contentRef.current) return;
    try {
      // Find all math formula elements or data-latex
      const mathElements = contentRef.current.querySelectorAll('[data-latex], .katex-formula, .katex-math-render');
      mathElements.forEach((el) => {
        const latex = el.getAttribute('data-latex') || el.textContent || '';
        if (latex.trim()) {
          try {
            katex.render(latex, el as HTMLElement, {
              displayMode: true,
              throwOnError: false,
            });
          } catch (_) {}
        }
      });
    } catch (_) {}
  }, [noteData?.content]);

  // Render handwriting / drawing strokes on canvas if present
  useEffect(() => {
    if (!noteData?.strokes || !canvasRef.current) return;
    try {
      const strokes = typeof noteData.strokes === 'string' ? JSON.parse(noteData.strokes) : noteData.strokes;
      if (!Array.isArray(strokes) || strokes.length === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 2;
      let maxX = 0;
      let maxY = 0;
      for (const s of strokes) {
        const pad = (s.size || 2) * 3;
        for (const p of s.points || []) {
          if (p.x + pad > maxX) maxX = p.x + pad;
          if (p.y + pad > maxY) maxY = p.y + pad;
        }
      }

      const width = Math.max(maxX, 400);
      const height = Math.max(maxY, 240);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const stroke of strokes) {
        if (!stroke.points || stroke.points.length === 0) continue;
        ctx.save();
        ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.38 : 1;
        ctx.strokeStyle = stroke.color || (isDark ? '#E8EEF3' : '#1C2B36');
        ctx.fillStyle = stroke.color || (isDark ? '#E8EEF3' : '#1C2B36');
        ctx.lineWidth = stroke.tool === 'highlighter' ? (stroke.size || 2) * 2.8 : (stroke.size || 2);

        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          const radius = (stroke.size || 2) * (p.pressure && p.pressure > 0 ? p.pressure * 1.2 : 1) / 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.5, radius), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            if (curr.pressure && curr.pressure > 0 && stroke.tool !== 'highlighter') {
              ctx.lineWidth = Math.max(1.5, (stroke.size || 2) * (0.45 + curr.pressure * 0.95));
            }
            ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    } catch (_) {}
  }, [noteData?.strokes, isDark]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handlePrint = () => {
    window.print();
  };

  if (!noteData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF6EF] dark:bg-[#0F1720] text-[#1C2B36] dark:text-[#E8EEF3]">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-[#16202A] border border-[#DFD3C0] dark:border-[#223344] shadow-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold">Invalid or Expired Note Link</h2>
          <p className="text-xs text-[#5A6E82] dark:text-[#8AA0B4] leading-relaxed">
            The shared link does not contain valid note data. Please ask the sender to copy the link again.
          </p>
          <button
            onClick={onExit}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover text-white font-semibold text-xs transition-all shadow-xs"
          >
            <Sparkles size={14} />
            <span>Open texō notes</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6EF] dark:bg-[#0F1720] text-[#1C2B36] dark:text-[#E8EEF3] transition-colors duration-200">
      {/* Kyoto Header Bar */}
      <header className="sticky top-0 z-50 px-4 sm:px-6 py-3 border-b border-[#DFD3C0] dark:border-[#223344] bg-[#FAF6EF]/90 dark:bg-[#16202A]/90 backdrop-blur-md flex items-center justify-between print:hidden">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div
            onClick={onExit}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition-opacity"
            title="Open texō notes"
          >
            <TexoLogo size={24} />
            <span className="font-bold text-base tracking-tight text-[#1C2B36] dark:text-[#E8EEF3]">
              texō
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EFE8DA] dark:bg-[#1C2733] text-[#5A6E82] dark:text-[#8AA0B4] border border-[#DFD3C0] dark:border-[#263747]">
            <Lock size={10} className="text-emerald-500" />
            <span>Read-Only Note</span>
          </span>
        </div>

        {/* Actions with authentic Lucide icons */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl border border-[#DFD3C0] dark:border-[#2A3E52] bg-white dark:bg-[#16202A] text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#F2ECE1] dark:hover:bg-[#202C39] transition-colors shadow-xs"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#DFD3C0] dark:border-[#2A3E52] bg-white dark:bg-[#16202A] text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#F2ECE1] dark:hover:bg-[#202C39] transition-colors text-xs font-medium shadow-xs"
            title="Print note"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>

          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#DFD3C0] dark:border-[#2A3E52] bg-white dark:bg-[#16202A] text-[#1C2B36] dark:text-[#E8EEF3] hover:bg-[#F2ECE1] dark:hover:bg-[#202C39] transition-colors text-xs font-medium shadow-xs"
            title="Copy shared link"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* Open / Launch texō */}
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover text-white font-semibold text-xs transition-all shadow-xs active:scale-95"
            title="Open texō notes"
          >
            <Sparkles size={14} />
            <span className="hidden xs:inline">Get texō</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <article className="bg-white dark:bg-[#16202A] border border-[#DFD3C0] dark:border-[#223344] rounded-2xl p-6 sm:p-10 shadow-sm relative transition-colors duration-200">
          {/* Note Metadata Header */}
          <div className="flex items-center justify-between text-xs text-[#5A6E82] dark:text-[#8AA0B4] pb-4 mb-6 border-b border-[#DFD3C0]/60 dark:border-[#223344]">
            <div className="flex items-center space-x-2">
              <Share2 size={13} className="text-[#395060] dark:text-[#7EAAD0]" />
              <span className="font-medium">Public Shared Note</span>
            </div>
            <span className="text-[11px] font-mono">Zero-Knowledge Encrypted</span>
          </div>

          {/* Note Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1C2B36] dark:text-[#E8EEF3] mb-6 leading-tight font-serif">
            {noteData.title || 'Untitled Note'}
          </h1>

          {/* Note Rich Content with Kyoto Tiptap typography */}
          <div
            ref={contentRef}
            className="tiptap Kyoto-note-content prose max-w-none text-[#1C2B36] dark:text-[#E8EEF3] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: noteData.content || '' }}
          />

          {/* Handwritten Annotation / Drawing Canvas */}
          {noteData.strokes && (
            <div className="mt-8 pt-6 border-t border-[#DFD3C0]/60 dark:border-[#223344]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6E82] dark:text-[#8AA0B4] mb-3">
                Handwritten Notes &amp; Sketches
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6EF]/60 dark:bg-[#121922]/60 border border-[#DFD3C0] dark:border-[#223344] overflow-x-auto">
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
              </div>
            </div>
          )}
        </article>
      </main>

      {/* Kyoto Footer */}
      <footer className="py-6 px-4 text-center border-t border-[#DFD3C0] dark:border-[#223344] bg-[#FAF6EF]/70 dark:bg-[#131B24]/70 text-xs text-[#5A6E82] dark:text-[#8AA0B4] print:hidden">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3">
          <span>
            Shared via <strong className="text-[#1C2B36] dark:text-[#E8EEF3]">texō</strong> — the cross-platform, zero-knowledge note-taking app.
          </span>
          <button
            onClick={onExit}
            className="text-apple-yellow hover:underline inline-flex items-center space-x-1 font-medium"
          >
            <span>Create your own notes</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </footer>
    </div>
  );
};
