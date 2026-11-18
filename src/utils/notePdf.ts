import { Editor as TiptapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { MathBlock } from '../extensions/MathExtension';
import { CustomCodeBlock } from '../extensions/CodeBlockExtension';
import type { Note } from '../types/note';
import type { InNoteStroke } from '../components/Drawing/InNoteCanvas';

export interface PdfExportOptions {
  /** Defaults to the current editor width; 720 CSS px when no editor is mounted. */
  widthPx?: number;
}

export interface PdfPageSlice { start: number; end: number }
export interface PdfKeepTogether { top: number; bottom: number }

/** Prefer a break before an intersected line/short object, without skipping any content. */
export function getPdfPageSlices(
  height: number,
  pageHeight: number,
  protectedRanges: PdfKeepTogether[],
): PdfPageSlice[] {
  if (!(height > 0) || !(pageHeight > 0) || !Number.isFinite(height + pageHeight)) {
    throw new Error('Invalid PDF page dimensions.');
  }
  const pages: PdfPageSlice[] = [];
  let start = 0;
  while (start < height) {
    const limit = Math.min(start + pageHeight, height);
    let end = limit;
    if (end < height) {
      // Each iteration moves backwards to another range boundary.
      for (let i = 0; i <= protectedRanges.length; i++) {
        const overlaps = protectedRanges.filter(r => r.top < end && r.bottom > end);
        if (!overlaps.length) break;
        const earlier = Math.min(...overlaps.map(r => r.top));
        if (earlier <= start + 1) {
          // An object taller than a page must be split. Never loop or drop it.
          end = limit;
          break;
        }
        end = earlier;
      }
    }
    pages.push({ start, end });
    start = end;
  }
  return pages;
}

function readStrokes(note: Note): InNoteStroke[] {
  if (!note.drawingStrokes) return [];
  const strokes: unknown = JSON.parse(note.drawingStrokes);
  if (!Array.isArray(strokes) || !strokes.every(s =>
    s && ['pen', 'highlighter', 'eraser'].includes(s.tool) &&
    typeof s.color === 'string' && Number.isFinite(s.size) && s.size > 0 &&
    Array.isArray(s.points) && s.points.every((p: { x: number; y: number; pressure?: number }) =>
      p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      (p.pressure === undefined || Number.isFinite(p.pressure))),
  )) {
    throw new Error('This note contains invalid drawing data. PDF export was cancelled.');
  }
  return strokes;
}

function strokeBounds(strokes: InNoteStroke[]) {
  let right = 0;
  let bottom = 0;
  for (const stroke of strokes) {
    const pad = stroke.size * 2.8 + 2;
    for (const p of stroke.points) {
      right = Math.max(right, p.x + pad);
      bottom = Math.max(bottom, p.y + pad);
    }
  }
  return { right, bottom };
}

/** Keep the same coordinates, pressure and brush algorithm as InNoteCanvas. */
function paintStrokes(ctx: CanvasRenderingContext2D, strokes: InNoteStroke[], pageTop: number) {
  ctx.save();
  ctx.translate(0, -pageTop);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.38 : 1;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.tool === 'highlighter' ? stroke.size * 2.8 : stroke.size;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const radius = stroke.size * (p.pressure && p.pressure > 0 ? p.pressure * 1.2 : 1) / 2;
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
          ctx.lineWidth = Math.max(1.5, stroke.size * (0.45 + curr.pressure * 0.95));
        }
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function within<T>(promise: Promise<T>, message: string, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      result => { clearTimeout(timer); resolve(result); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function prepareImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async img => {
    // Embed resources up front: do not silently download a PDF with missing images.
    const src = img.currentSrc || img.src;
    if (!src) throw new Error('A note image has no source.');
    if (!src.startsWith('data:')) {
      const response = await fetch(src, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`A note image could not be loaded (HTTP ${response.status}).`);
      const blob = await response.blob();
      img.src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('A note image could not be read.'));
        reader.readAsDataURL(blob);
      });
    }
    img.removeAttribute('srcset');
    img.loading = 'eager';
    await within(img.decode(), 'A note image did not finish loading.');
    if (!img.naturalWidth) throw new Error('A note image could not be decoded.');
  }));
}

function inheritedStyle(source: HTMLElement, target: HTMLElement) {
  const style = getComputedStyle(source);
  for (const name of [
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color',
    'letter-spacing', 'word-spacing', 'white-space', 'direction', 'text-align',
    'font-feature-settings', 'font-variation-settings', 'font-kerning', 'text-rendering',
  ]) target.style.setProperty(name, style.getPropertyValue(name));
}

function removeEditorDecorations(root: HTMLElement) {
  root.removeAttribute('contenteditable');
  root.querySelectorAll('.search-match, .search-match-active').forEach(el => el.replaceWith(...el.childNodes));
  root.querySelectorAll('.column-resize-handle, .ProseMirror-gapcursor').forEach(el => el.remove());
  [root, ...root.querySelectorAll<HTMLElement>('*')].forEach(el => {
    // Keep nested contenteditable=false: ProseMirror uses it for math whitespace.
    el.removeAttribute('data-placeholder');
    el.classList.remove('is-editor-empty', 'is-empty-node', 'ProseMirror-selectednode', 'selectedCell');
    // A newly mounted read-only editor can otherwise be measured midway through
    // an image's margin transition when .tiptap is applied to its root.
    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('animation', 'none', 'important');
  });
  // A formula node view has a hover badge which is UI, not part of the note.
  root.querySelectorAll('.katex-math-block > span').forEach(el => el.remove());
}

/** A disposable snapshot. Uses the live note only when its ID matches the export. */
export async function prepareNoteForPdf(note: Note, options: PdfExportOptions = {}) {
  // Desktop and mobile editors can both be mounted. Hidden editors have no layout.
  const wrappers = Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-note-id]'))
    .filter(el => el.getBoundingClientRect().width > 0 && el.getClientRects().length > 0);
  const source = wrappers.find(el => el.dataset.pdfNoteId === note.id)?.querySelector<HTMLElement>('.tiptap');
  const reference = source || wrappers[0]?.querySelector<HTMLElement>('.tiptap');
  const referenceWidth = reference?.getBoundingClientRect().width;
  const textWidth = options.widthPx ?? (referenceWidth && referenceWidth > 0 ? referenceWidth : 720);
  if (!Number.isFinite(textWidth) || textWidth < 1 || textWidth > 4096) {
    throw new Error('PDF layout width must be between 1 and 4096 CSS pixels.');
  }
  const strokes = readStrokes(note);
  const bounds = strokeBounds(strokes);
  const dark = Boolean(reference?.closest('.dark') || document.documentElement.classList.contains('dark'));
  const backgroundColor = dark ? '#131B24' : '#FAF6EF';

  const mount = document.createElement('div');
  mount.dataset.pdfSnapshot = '';
  mount.className = dark ? 'dark' : '';
  mount.setAttribute('aria-hidden', 'true');
  Object.assign(mount.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' });
  const viewport = document.createElement('div');
  const content = document.createElement('div');
  // flow-root contains the first/last paragraph margins instead of losing them off-page.
  Object.assign(content.style, { width: `${textWidth}px`, display: 'flow-root' });
  Object.assign(viewport.style, { position: 'relative', overflow: 'hidden', backgroundColor });
  inheritedStyle(reference || document.body, content);
  viewport.appendChild(content);
  mount.appendChild(viewport);
  document.body.appendChild(mount);
  let readonlyEditor: TiptapEditor | undefined;
  const dispose = () => { readonlyEditor?.destroy(); mount.remove(); };

  try {
    let prose: HTMLElement;
    if (source) {
      prose = source.cloneNode(true) as HTMLElement;
      inheritedStyle(source, prose);
      content.appendChild(prose);
      const originals = source.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      prose.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input, i) => {
        input.checked = originals[i].checked;
      });
    } else {
      // ZIP export also renders notes which aren't currently open. TipTap supplies
      // trailing <br>s, task-list structure, tables and the actual math node view.
      readonlyEditor = new TiptapEditor({
        element: content,
        editable: false,
        extensions: [
          StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] } }),
          CustomCodeBlock,
          Underline, Highlight.configure({ multicolor: false }), TaskList,
          TaskItem.configure({ nested: true }),
          Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
          TableRow, TableCell, TableHeader, MathBlock,
          Image.configure({ allowBase64: true, HTMLAttributes: { class: 'note-drawing-image' } }),
        ],
        content: note.content || '<p></p>',
      });
      prose = readonlyEditor.view.dom;
    }
    removeEditorDecorations(prose);
    Object.assign(prose.style, { minHeight: '0', caretColor: 'transparent' });
    // Reuse .tiptap / ProseMirror styles. Do not rewrite text, font sizes or headings.
    await prepareImages(prose);
    await within(document.fonts.ready, 'Note fonts did not finish loading.');

    // The live editor's first margin collapses outside its drawing layer. Keep
    // that exact text/canvas origin while containing margins in the snapshot.
    const sourceOrigin = source?.closest('[data-pdf-note-id]')?.parentElement;
    const sourceOffset = source && sourceOrigin
      ? source.getBoundingClientRect().top - sourceOrigin.getBoundingClientRect().top : 0;
    const offsetY = sourceOffset - (prose.getBoundingClientRect().top - content.getBoundingClientRect().top);
    content.style.transform = `translateY(${offsetY}px)`;

    // Include overflow (e.g. long code or an old drawing) without rewrapping the
    // text or scaling drawing X coordinates independently from the text.
    const width = Math.ceil(Math.max(textWidth, content.scrollWidth, bounds.right));
    const height = Math.max(1, Math.ceil(Math.max(content.getBoundingClientRect().height + offsetY, content.scrollHeight + offsetY, bounds.bottom)));
    viewport.style.width = `${width}px`;
    viewport.style.height = `${height}px`;
    // html-to-image 1.11.13 rounds font sizes down while copying computed styles.
    // Override that adjustment in its serialized SVG, including fractional KaTeX
    // sizes, so the final painted page keeps the measured layout.
    const fontSizes = new Map<string, number>();
    [viewport, ...viewport.querySelectorAll<HTMLElement>('*')].forEach(el => {
      const size = getComputedStyle(el).fontSize;
      if (!fontSizes.has(size)) fontSizes.set(size, fontSizes.size);
      el.setAttribute('data-pdf-font', String(fontSizes.get(size)));
    });
    // An explicit copied height stops child margins collapsing through these
    // wrappers, compressing list spacing and the gap following a table.
    const fontSizeCSS = Array.from(fontSizes, ([size, id]) =>
      `[data-pdf-font="${id}"] { font-size: ${size} !important; }`,
    ).join('\n') + '\n.tiptap li, .tiptap .tableWrapper { height: auto !important; }';
    return { viewport, content, prose, width, height, offsetY, strokes, backgroundColor, fontSizeCSS, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function keepTogetherRanges(content: HTMLElement, pageHeight: number, origin: number): PdfKeepTogether[] {
  const ranges: PdfKeepTogether[] = [];
  const add = (rect: DOMRect, inset = 0) => {
    if (rect.height > 0 && rect.height < pageHeight) {
      ranges.push({ top: Math.max(0, rect.top - origin + inset), bottom: rect.bottom - origin - inset });
    }
  };
  // Text ranges have one rectangle per rendered line, including within a long paragraph.
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let text: Node | null;
  const range = document.createRange();
  while ((text = walker.nextNode())) {
    if (!text.textContent?.trim() || text.parentElement?.closest('.katex')) continue;
    range.selectNodeContents(text);
    Array.from(range.getClientRects()).forEach(rect => add(rect));
  }
  content.querySelectorAll('img, .katex-math-block, tr, hr').forEach(el => {
    // Adjacent table rows share a border; allow a break on that border.
    add(el.getBoundingClientRect(), el.tagName === 'TR' ? 0.5 : 0);
  });
  content.querySelectorAll('h1, h2, h3').forEach(heading => {
    const next = heading.nextElementSibling;
    if (!next) return;
    const rect = heading.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    const bottom = Math.min(nextRect.bottom, nextRect.top + 32);
    if (bottom - rect.top < pageHeight) ranges.push({ top: rect.top - origin, bottom: bottom - origin });
  });
  return ranges;
}

interface SelectableTextItem {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  isBold?: boolean;
  isItalic?: boolean;
}

function extractSelectableTextItems(
  content: HTMLElement,
  originTop: number,
  originLeft: number
): SelectableTextItem[] {
  const items: SelectableTextItem[] = [];

  // 1. Math formulas: preserve formula expression for search & copy
  content.querySelectorAll<HTMLElement>('[data-type="math-block"], .katex-math-block').forEach((mathEl) => {
    const latex = mathEl.getAttribute('data-latex');
    if (latex && latex.trim()) {
      const rect = mathEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({
          text: latex.trim(),
          left: rect.left - originLeft,
          top: rect.top - originTop,
          width: rect.width,
          height: rect.height,
          fontSize: 13,
          isItalic: true,
        });
      }
    }
  });

  // 2. Checkbox states: preserve [x] or [ ]
  content.querySelectorAll<HTMLElement>('[data-type="taskItem"]').forEach((taskItem) => {
    const checkbox = taskItem.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox) {
      const rect = checkbox.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({
          text: checkbox.checked ? '[x]' : '[ ]',
          left: rect.left - originLeft,
          top: rect.top - originTop,
          width: rect.width,
          height: rect.height,
          fontSize: 12,
        });
      }
    }
  });

  // 3. Regular text content
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let textNode: Node | null;
  const range = document.createRange();

  while ((textNode = walker.nextNode())) {
    const rawText = textNode.textContent;
    if (!rawText || !rawText.trim()) continue;

    const parent = textNode.parentElement;
    if (!parent || parent.closest('.katex') || parent.closest('.tiptap-table-controls')) continue;

    const computed = getComputedStyle(parent);
    const fontSize = parseFloat(computed.fontSize) || 16;
    const isBold = parseInt(computed.fontWeight, 10) >= 600 || computed.fontWeight === 'bold';
    const isItalic = computed.fontStyle === 'italic';

    range.selectNodeContents(textNode);
    const rects = Array.from(range.getClientRects());
    if (rects.length <= 1) {
      const r = rects[0] || range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        items.push({
          text: rawText,
          left: r.left - originLeft,
          top: r.top - originTop,
          width: r.width,
          height: r.height,
          fontSize,
          isBold,
          isItalic,
        });
      }
    } else {
      const tokens = rawText.split(/(\s+)/);
      let charOffset = 0;
      let currentLineWords: string[] = [];
      let lineRect: { left: number; top: number; right: number; bottom: number } | null = null;

      for (const token of tokens) {
        if (!token) continue;
        const start = charOffset;
        const end = charOffset + token.length;
        charOffset = end;

        if (!token.trim()) {
          if (lineRect) {
            currentLineWords.push(token);
          }
          continue;
        }

        range.setStart(textNode, start);
        range.setEnd(textNode, end);
        const wr = range.getBoundingClientRect();
        if (!wr.width || !wr.height) continue;

        if (!lineRect) {
          lineRect = { left: wr.left, top: wr.top, right: wr.right, bottom: wr.bottom };
          currentLineWords = [token];
        } else if (Math.abs(wr.top - lineRect.top) < fontSize * 0.8) {
          lineRect.right = Math.max(lineRect.right, wr.right);
          lineRect.bottom = Math.max(lineRect.bottom, wr.bottom);
          currentLineWords.push(token);
        } else {
          items.push({
            text: currentLineWords.join(''),
            left: lineRect.left - originLeft,
            top: lineRect.top - originTop,
            width: lineRect.right - lineRect.left,
            height: lineRect.bottom - lineRect.top,
            fontSize,
            isBold,
            isItalic,
          });
          lineRect = { left: wr.left, top: wr.top, right: wr.right, bottom: wr.bottom };
          currentLineWords = [token];
        }
      }

      if (lineRect && currentLineWords.length > 0) {
        items.push({
          text: currentLineWords.join(''),
          left: lineRect.left - originLeft,
          top: lineRect.top - originTop,
          width: lineRect.right - lineRect.left,
          height: lineRect.bottom - lineRect.top,
          fontSize,
          isBold,
          isItalic,
        });
      }
    }
  }

  return items;
}

/** Render one bounded canvas per page; retain the Blob API for download/Share/ZIP. */
export async function generateNotePdfBlob(note: Note, options: PdfExportOptions = {}): Promise<Blob> {
  const snapshot = await prepareNoteForPdf(note, options);
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const printWidth = pageWidth - 2 * margin;
    const pageHeightPx = snapshot.width * (pageHeight - 2 * margin) / printWidth;
    const originTop = snapshot.viewport.getBoundingClientRect().top;
    const originLeft = snapshot.viewport.getBoundingClientRect().left;
    const pages = getPdfPageSlices(snapshot.height, pageHeightPx,
      keepTogetherRanges(snapshot.content, pageHeightPx, originTop));
    const textItems = extractSelectableTextItems(snapshot.content, originTop, originLeft);
    const scaleMmPerPx = printWidth / snapshot.width;

    // Embed KaTeX fonts once and reuse them on all pages.
    const fontEmbedCSS = (await getFontEmbedCSS(snapshot.viewport, { preferredFontFormat: 'woff2' })) + '\n' + snapshot.fontSizeCSS;
    pdf.setProperties({ title: note.title || 'Untitled', creator: 'texō' });

    for (let i = 0; i < pages.length; i++) {
      const { start, end } = pages[i];
      const height = end - start;
      snapshot.viewport.style.height = `${height}px`;
      snapshot.content.style.transform = `translateY(${snapshot.offsetY - start}px)`;
      const canvas = await toCanvas(snapshot.viewport, {
        width: snapshot.width,
        height,
        pixelRatio: Math.min(2, 4096 / Math.max(snapshot.width, height)),
        backgroundColor: snapshot.backgroundColor,
        fontEmbedCSS,
      });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to create a PDF page canvas.');
      ctx.save();
      ctx.scale(canvas.width / snapshot.width, canvas.height / height);
      paintStrokes(ctx, snapshot.strokes, start);
      ctx.restore();
      if (i > 0) pdf.addPage();
      pdf.setFillColor(snapshot.backgroundColor);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.addImage(canvas, 'PNG', margin, margin, printWidth, height * printWidth / snapshot.width);
      // A long note must not keep a full-height, high-DPI canvas alive.
      canvas.width = 0;
      canvas.height = 0;

      // Overlay invisible selectable text on top of the page canvas image
      const pageTextItems = textItems.filter(item => item.top >= start && item.top < end);
      for (const item of pageTextItems) {
        try {
          const fontStyle = item.isBold ? (item.isItalic ? 'bolditalic' : 'bold') : (item.isItalic ? 'italic' : 'normal');
          pdf.setFont('helvetica', fontStyle);
          let fontSizePt = item.fontSize * scaleMmPerPx * (72 / 25.4);
          pdf.setFontSize(Math.max(4, fontSizePt));

          const targetWidthMm = item.width * scaleMmPerPx;
          const currentWidthMm = pdf.getTextWidth(item.text);
          if (currentWidthMm > 0 && targetWidthMm > 0 && currentWidthMm > targetWidthMm) {
            fontSizePt = Math.max(4, fontSizePt * (targetWidthMm / currentWidthMm));
            pdf.setFontSize(fontSizePt);
          }

          const xMm = margin + (item.left * scaleMmPerPx);
          const yMm = margin + ((item.top - start) * scaleMmPerPx);

          pdf.text(item.text, xMm, yMm, {
            baseline: 'top',
            renderingMode: 'invisible',
          });
        } catch (_) {
          // Gracefully continue on any single string formatting edge case
        }
      }
    }
    return pdf.output('blob');
  } finally {
    snapshot.dispose();
  }
}
