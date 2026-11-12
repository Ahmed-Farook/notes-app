import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Note } from '../types/note';
import { formatEditorDate } from './dateUtils';
import type { InNoteStroke } from '../components/Drawing/InNoteCanvas';

/**
 * Escapes HTML special characters safely.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Applies inline markdown formatting safely after escaping HTML.
 */
function formatInlineMarkdown(rawLine: string): string {
  return escapeHtml(rawLine)
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*])\*([^*]+?)\*([^*]|$)/g, '$1<em>$2</em>$3');
}

/**
 * Shared parser converting Markdown / structured Plain Text lines into full TipTap HTML,
 * supporting interactive task checkboxes (- [x], - [ ], [x], [ ]), bullet lists (-, *, •),
 * ordered lists (1.), fenced code blocks (```), headings (#), blockquotes (>), and dividers (---).
 */
function parseStructuredLinesToTipTapHtml(
  rawInput: string,
  options: { parseInlineMarkdown: boolean; fallbackTitle?: string }
): { title: string; content: string; plainTextPreview: string } {
  const normalized = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const htmlParts: string[] = [];
  const plainLines: string[] = [];

  type ListType = 'taskList' | 'bulletList' | 'orderedList' | null;
  let activeList: ListType = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const closeActiveList = () => {
    if (activeList === 'taskList') {
      htmlParts.push('</ul>');
    } else if (activeList === 'bulletList') {
      htmlParts.push('</ul>');
    } else if (activeList === 'orderedList') {
      htmlParts.push('</ol>');
    }
    activeList = null;
  };

  const renderInline = (text: string) =>
    options.parseInlineMarkdown ? formatInlineMarkdown(text) : escapeHtml(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code blocks ```
    if (trimmed.startsWith('```')) {
      closeActiveList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        htmlParts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      plainLines.push(trimmed);
      continue;
    }

    if (!trimmed) {
      closeActiveList();
      htmlParts.push('<p></p>');
      continue;
    }

    // Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeActiveList();
      htmlParts.push('<hr>');
      continue;
    }

    // Task item patterns: "- [x] foo", "- [ ] foo", "* [x] foo", "[x] foo", "[ ] foo"
    const taskMatch = trimmed.match(/^(?:[-*•]\s+)?\[([xX ])\]\s*(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      const itemText = taskMatch[2] || '';
      plainLines.push(itemText || trimmed);

      if (activeList !== 'taskList') {
        closeActiveList();
        htmlParts.push('<ul data-type="taskList">');
        activeList = 'taskList';
      }

      htmlParts.push(
        `<li data-type="taskItem" data-checked="${checked ? 'true' : 'false'}"><label><input type="checkbox"${
          checked ? ' checked="checked"' : ''
        }><span></span></label><div><p>${renderInline(itemText)}</p></div></li>`
      );
      continue;
    }

    // Bullet list patterns: "- foo", "* foo", "• foo"
    const bulletMatch = trimmed.match(/^(?:[-*•])\s+(.+)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1];
      plainLines.push(itemText);

      if (activeList !== 'bulletList') {
        closeActiveList();
        htmlParts.push('<ul>');
        activeList = 'bulletList';
      }

      htmlParts.push(`<li><p>${renderInline(itemText)}</p></li>`);
      continue;
    }

    // Ordered list patterns: "1. foo", "2) foo"
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const itemText = orderedMatch[1];
      plainLines.push(itemText);

      if (activeList !== 'orderedList') {
        closeActiveList();
        htmlParts.push('<ol>');
        activeList = 'orderedList';
      }

      htmlParts.push(`<li><p>${renderInline(itemText)}</p></li>`);
      continue;
    }

    closeActiveList();

    // Headings
    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4);
      plainLines.push(text);
      htmlParts.push(`<h3>${renderInline(text)}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3);
      plainLines.push(text);
      htmlParts.push(`<h2>${renderInline(text)}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      const text = trimmed.slice(2);
      plainLines.push(text);
      htmlParts.push(`<h1>${renderInline(text)}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      const text = trimmed.slice(2);
      plainLines.push(text);
      htmlParts.push(`<blockquote><p>${renderInline(text)}</p></blockquote>`);
    } else {
      plainLines.push(trimmed);
      // If plain text import and this is the very first non-empty line, promote cleanly to H1
      if (!options.parseInlineMarkdown && htmlParts.filter((p) => p !== '<p></p>').length === 0) {
        htmlParts.push(`<h1>${escapeHtml(trimmed)}</h1>`);
      } else {
        htmlParts.push(`<p>${renderInline(line)}</p>`);
      }
    }
  }

  closeActiveList();
  if (inCodeBlock && codeBuffer.length > 0) {
    htmlParts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }

  const title =
    plainLines.length > 0
      ? plainLines[0].substring(0, 80)
      : (options.fallbackTitle || 'Imported Note').substring(0, 80);

  const plainTextPreview =
    plainLines.length > 1
      ? plainLines.slice(1).join(' ').substring(0, 150)
      : plainLines.length === 1 && plainLines[0] !== title
      ? plainLines[0].substring(0, 150)
      : 'No additional text';

  return {
    title,
    content: htmlParts.join('') || '<h1>Imported Note</h1><p></p>',
    plainTextPreview,
  };
}

/**
 * Converts TipTap HTML into clean plain text while preserving all line breaks,
 * paragraphs, headings, lists, task checklists, quotes, and code blocks.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n---\n';

    let inner = '';
    el.childNodes.forEach((child) => {
      inner += walk(child);
    });

    if (tag === 'li') {
      const isTask =
        el.getAttribute('data-type') === 'taskItem' ||
        Boolean(el.querySelector('input[type="checkbox"]'));
      const cleanInner = inner.replace(/\n+$/, '');
      if (isTask) {
        const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const checked = el.getAttribute('data-checked') === 'true' || Boolean(checkbox?.checked);
        return `${checked ? '[x]' : '[ ]'} ${cleanInner.trim()}\n`;
      }
      const parentTag = el.parentElement?.tagName.toLowerCase();
      if (parentTag === 'ol' && el.parentElement) {
        const index = Array.from(el.parentElement.children).indexOf(el) + 1;
        return `${index}. ${cleanInner.trim()}\n`;
      }
      return `• ${cleanInner.trim()}\n`;
    }

    if (tag === 'ul' || tag === 'ol') {
      return `${inner.replace(/\n+$/, '')}\n\n`;
    }

    if (tag === 'blockquote') {
      const lines = inner.replace(/\n+$/, '').split('\n');
      return lines.map((line) => `> ${line}`).join('\n') + '\n\n';
    }

    if (tag === 'pre') {
      return `\`\`\`\n${inner.replace(/\n+$/, '')}\n\`\`\`\n\n`;
    }

    if (
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'p' ||
      tag === 'div'
    ) {
      const clean = inner.replace(/\n+$/, '');
      if (!clean) return '\n';
      return `${clean}\n`;
    }

    return inner;
  };

  let output = '';
  container.childNodes.forEach((child) => {
    output += walk(child);
  });

  return output.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Converts TipTap HTML into clean Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n---\n\n';

    let inner = '';
    el.childNodes.forEach((child) => {
      inner += walk(child);
    });

    switch (tag) {
      case 'h1':
        return `# ${inner.trim()}\n\n`;
      case 'h2':
        return `## ${inner.trim()}\n\n`;
      case 'h3':
        return `### ${inner.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${inner}**`;
      case 'em':
      case 'i':
        return `*${inner}*`;
      case 'u':
        return `<u>${inner}</u>`;
      case 's':
      case 'del':
        return `~~${inner}~~`;
      case 'mark':
        return `==${inner}==`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return inner;
        return `\`${inner}\``;
      case 'pre':
        return `\`\`\`\n${inner.replace(/\n+$/, '')}\n\`\`\`\n\n`;
      case 'blockquote':
        return (
          inner
            .replace(/\n+$/, '')
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n') + '\n\n'
        );
      case 'li': {
        const isTask =
          el.getAttribute('data-type') === 'taskItem' ||
          Boolean(el.querySelector('input[type="checkbox"]'));
        const cleanInner = inner.replace(/\n+$/, '').trim();
        if (isTask) {
          const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          const checked = el.getAttribute('data-checked') === 'true' || Boolean(checkbox?.checked);
          return `- [${checked ? 'x' : ' '}] ${cleanInner}\n`;
        }
        const parentTag = el.parentElement?.tagName.toLowerCase();
        if (parentTag === 'ol' && el.parentElement) {
          const idx = Array.from(el.parentElement.children).indexOf(el) + 1;
          return `${idx}. ${cleanInner}\n`;
        }
        return `- ${cleanInner}\n`;
      }
      case 'ul':
      case 'ol':
        return `${inner.replace(/\n+$/, '')}\n\n`;
      case 'p':
      case 'div': {
        const clean = inner.replace(/\n+$/, '');
        return clean ? `${clean}\n\n` : '\n';
      }
      default:
        return inner;
    }
  };

  let output = '';
  container.childNodes.forEach((child) => {
    output += walk(child);
  });

  return output.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Formats a note into string content and file extension based on chosen text/markup format.
 */
export function formatNoteForExport(
  note: Note,
  formatType: 'markdown' | 'txt' | 'html'
): { content: string; ext: string; mimeType: string } {
  if (formatType === 'txt') {
    return {
      content: htmlToPlainText(note.content),
      ext: 'txt',
      mimeType: 'text/plain;charset=utf-8',
    };
  }
  if (formatType === 'markdown') {
    return {
      content: htmlToMarkdown(note.content),
      ext: 'md',
      mimeType: 'text/markdown;charset=utf-8',
    };
  }
  return {
    content: `<!DOCTYPE html><html><head><title>${escapeHtml(
      note.title || 'Untitled'
    )}</title><meta charset="utf-8"></head><body>${note.content}</body></html>`,
    ext: 'html',
    mimeType: 'text/html;charset=utf-8',
  };
}

/**
 * Sanitizes a filename so it is safe on macOS, Windows, and Android.
 */
function sanitizeFilename(name: string): string {
  return (
    (name || 'Untitled')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Untitled'
  );
}

/**
 * Triggers browser/native download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders both formatted note text/checklists and handwritten InNoteCanvas strokes into a clean
 * multi-page A4 PDF Blob using jsPDF + html2canvas.
 */
export async function generateNotePdfBlob(note: Note): Promise<Blob> {
  const pageWidthPx = 768; // Matches TipTap max-w-3xl width cleanly so drawing coordinates align!
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${pageWidthPx}px`;
  host.style.backgroundColor = '#FAF6EF';
  host.style.color = '#1C2B36';
  host.style.padding = '36px 48px 48px 48px';
  host.style.boxSizing = 'border-box';
  host.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  host.style.zIndex = '-1';

  // Scoped typography styles matching the editor so lists, code blocks & checkboxes render faithfully
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .pdf-root h1 { font-size: 28px; line-height: 1.25; font-weight: 700; margin: 4px 0 12px 0; color: #1C2B36; }
    .pdf-root h2 { font-size: 22px; line-height: 1.3; font-weight: 600; margin: 12px 0 8px 0; color: #1C2B36; }
    .pdf-root h3 { font-size: 18px; line-height: 1.35; font-weight: 600; margin: 8px 0 6px 0; color: #1C2B36; }
    .pdf-root p { font-size: 15px; line-height: 1.6; margin: 0 0 8px 0; min-height: 16px; }
    .pdf-root ul:not([data-type="taskList"]) { list-style: disc; padding-left: 24px; margin: 0 0 10px 0; font-size: 15px; }
    .pdf-root ol { list-style: decimal; padding-left: 24px; margin: 0 0 10px 0; font-size: 15px; }
    .pdf-root ul[data-type="taskList"] { list-style: none; padding: 0; margin: 6px 0 10px 0; }
    .pdf-root ul[data-type="taskList"] li { display: flex; align-items: flex-start; margin-bottom: 6px; }
    .pdf-root .pdf-cb { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #213A50; margin-right: 10px; margin-top: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .pdf-root .pdf-cb.checked { background: #213A50; color: #FFFFFF; }
    .pdf-root li[data-checked="true"] > div { text-decoration: line-through; color: #7A8B99; }
    .pdf-root blockquote { border-left: 3px solid #213A50; padding-left: 14px; margin: 10px 0; font-style: italic; color: #395060; }
    .pdf-root pre { background: #192531; color: #f8fafc; padding: 12px 14px; border-radius: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 13px; margin: 10px 0; white-space: pre-wrap; }
    .pdf-root code:not(pre code) { background: #E8F1F7; color: #213A50; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 13px; }
    .pdf-root mark { background: #E8F1F7; color: #213A50; padding: 1px 3px; border-radius: 3px; }
    .pdf-root hr { border: none; border-top: 1px solid #DFD3C0; margin: 14px 0; }
  `;
  host.appendChild(styleEl);

  const dateHeader = document.createElement('div');
  dateHeader.style.textAlign = 'center';
  dateHeader.style.fontSize = '11px';
  dateHeader.style.fontWeight = '600';
  dateHeader.style.color = '#6E8092';
  dateHeader.style.marginBottom = '16px';
  dateHeader.textContent = formatEditorDate(note.updatedAt || Date.now());
  host.appendChild(dateHeader);

  const contentLayer = document.createElement('div');
  contentLayer.className = 'pdf-root';
  contentLayer.style.position = 'relative';

  const proseLayer = document.createElement('div');
  proseLayer.innerHTML = note.content || '<p></p>';

  // Replace TipTap native checkbox inputs with reliable pure-CSS circles so html2canvas renders ticks sharply
  proseLayer.querySelectorAll('li[data-type="taskItem"]').forEach((li) => {
    const isChecked =
      li.getAttribute('data-checked') === 'true' ||
      Boolean((li.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.checked);
    const label = li.querySelector(':scope > label');
    if (label) {
      const box = document.createElement('div');
      box.className = `pdf-cb${isChecked ? ' checked' : ''}`;
      box.textContent = isChecked ? '✓' : '';
      label.replaceWith(box);
    }
  });

  contentLayer.appendChild(proseLayer);

  // Parse drawing strokes if present
  let parsedStrokes: InNoteStroke[] = [];
  let maxStrokeY = 0;
  let maxStrokeX = 0;
  if (note.drawingStrokes) {
    try {
      const raw = JSON.parse(note.drawingStrokes);
      if (Array.isArray(raw)) {
        parsedStrokes = raw;
        for (const s of parsedStrokes) {
          for (const p of s.points) {
            if (p.y > maxStrokeY) maxStrokeY = p.y;
            if (p.x > maxStrokeX) maxStrokeX = p.x;
          }
        }
      }
    } catch (_) {}
  }

  document.body.appendChild(host);

  try {
    const contentWidth = contentLayer.getBoundingClientRect().width || pageWidthPx - 96;
    const contentHeight = Math.max(
      contentLayer.scrollHeight,
      maxStrokeY > 0 ? Math.ceil(maxStrokeY + 40) : 200
    );
    contentLayer.style.minHeight = `${contentHeight}px`;

    // Render all handwritten strokes onto an aligned high-DPI canvas overlay
    if (parsedStrokes.length > 0) {
      const strokeCanvas = document.createElement('canvas');
      const dpr = 2;
      strokeCanvas.width = Math.ceil(contentWidth * dpr);
      strokeCanvas.height = Math.ceil(contentHeight * dpr);
      strokeCanvas.style.position = 'absolute';
      strokeCanvas.style.top = '0';
      strokeCanvas.style.left = '0';
      strokeCanvas.style.width = `${contentWidth}px`;
      strokeCanvas.style.height = `${contentHeight}px`;
      strokeCanvas.style.pointerEvents = 'none';

      const ctx = strokeCanvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        // Scale down horizontally only if strokes were drawn on a wider desktop viewport
        const xScale = maxStrokeX > contentWidth ? contentWidth / maxStrokeX : 1;

        for (const stroke of parsedStrokes) {
          if (stroke.points.length === 0) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Map bright dark-mode inks (#E8EEF3 / #FFFFFF) to Kyoto Indigo so they stand out cleanly on light paper PDF
          let inkColor = stroke.color;
          const upper = (inkColor || '').toUpperCase();
          if (upper === '#FFFFFF' || upper === '#E8EEF3' || upper === '#FAF6EF') {
            inkColor = '#213A50';
          }

          if (stroke.tool === 'highlighter') {
            ctx.globalAlpha = 0.38;
            ctx.strokeStyle = inkColor;
            ctx.lineWidth = stroke.size * 2.8;
          } else {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = inkColor;
            ctx.lineWidth = stroke.size;
          }

          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            ctx.fillStyle = inkColor;
            ctx.beginPath();
            ctx.arc(p.x * xScale, p.y, Math.max(1.5, stroke.size / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            continue;
          }

          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x * xScale, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            const midX = ((prev.x + curr.x) / 2) * xScale;
            const midY = (prev.y + curr.y) / 2;
            if (curr.pressure && curr.pressure > 0 && stroke.tool !== 'highlighter') {
              ctx.lineWidth = Math.max(1.5, stroke.size * (0.45 + curr.pressure * 0.95));
            }
            ctx.quadraticCurveTo(prev.x * xScale, prev.y, midX, midY);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x * xScale, last.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      contentLayer.appendChild(strokeCanvas);
    }

    host.appendChild(contentLayer);

    const renderedCanvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: '#FAF6EF',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (renderedCanvas.height * pdfWidth) / renderedCanvas.width;

    const imgData = renderedCanvas.toDataURL('image/png');
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 2) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}

/**
 * Exports a single note directly (including PDF with drawings).
 */
export async function exportSingleNote(
  note: Note,
  formatType: 'markdown' | 'txt' | 'html' | 'pdf'
): Promise<void> {
  const safeBase = sanitizeFilename(note.title || 'Untitled');
  if (formatType === 'pdf') {
    const pdfBlob = await generateNotePdfBlob(note);
    downloadBlob(pdfBlob, `${safeBase}.pdf`);
    return;
  }

  const { content, ext, mimeType } = formatNoteForExport(note, formatType);
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, `${safeBase}.${ext}`);
}

/**
 * Bundles multiple selected notes into a single downloadable .zip archive.
 */
export async function exportNotesAsZip(
  notesToExport: Note[],
  formatType: 'markdown' | 'txt' | 'html' | 'pdf' = 'txt'
): Promise<void> {
  if (notesToExport.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const note of notesToExport) {
    const baseName = sanitizeFilename(note.title || 'Untitled');
    const count = usedNames.get(baseName.toLowerCase()) || 0;
    usedNames.set(baseName.toLowerCase(), count + 1);

    if (formatType === 'pdf') {
      const pdfBlob = await generateNotePdfBlob(note);
      const uniqueName = count === 0 ? `${baseName}.pdf` : `${baseName} (${count + 1}).pdf`;
      zip.file(uniqueName, pdfBlob);
    } else {
      const { content, ext } = formatNoteForExport(note, formatType);
      const uniqueName = count === 0 ? `${baseName}.${ext}` : `${baseName} (${count + 1}).${ext}`;
      zip.file(uniqueName, content);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(zipBlob, `texo-notes-${dateStr}.zip`);
}

/**
 * Converts plain text (with \n line breaks and [x]/[ ]/bullet/numbered lists) into TipTap HTML.
 */
export function plainTextToNotePayload(
  rawText: string,
  filenameWithoutExt?: string
): { title: string; content: string; plainTextPreview: string } {
  return parseStructuredLinesToTipTapHtml(rawText, {
    parseInlineMarkdown: false,
    fallbackTitle: filenameWithoutExt,
  });
}

/**
 * Converts Markdown (including GFM task checkboxes - [x] / - [ ], lists, code blocks, quotes)
 * into TipTap-compatible interactive HTML.
 */
export function markdownToNotePayload(
  rawMd: string,
  filenameWithoutExt?: string
): { title: string; content: string; plainTextPreview: string } {
  return parseStructuredLinesToTipTapHtml(rawMd, {
    parseInlineMarkdown: true,
    fallbackTitle: filenameWithoutExt,
  });
}

/**
 * Parses uploaded .txt, .md, .html, or .zip files into Note payloads ready to insert.
 */
export async function parseImportedFiles(
  files: FileList | File[]
): Promise<Array<{ title: string; content: string; plainTextPreview: string }>> {
  const results: Array<{ title: string; content: string; plainTextPreview: string }> = [];
  const fileArray = Array.from(files);

  const processTextEntry = (filename: string, rawText: string) => {
    const lower = filename.toLowerCase();
    const baseName = filename.replace(/\.[^/.]+$/, '');
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      results.push(markdownToNotePayload(rawText, baseName));
    } else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      const doc = new DOMParser().parseFromString(rawText, 'text/html');
      const bodyHtml = doc.body?.innerHTML || `<p>${escapeHtml(rawText)}</p>`;
      const plain = (doc.body?.textContent || '').trim();
      const firstLine = plain.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      results.push({
        title: (doc.title || firstLine || baseName || 'Imported Note').substring(0, 80),
        content: bodyHtml,
        plainTextPreview: plain.substring(0, 150) || 'No additional text',
      });
    } else {
      results.push(plainTextToNotePayload(rawText, baseName));
    }
  };

  for (const file of fileArray) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      try {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(
          (entry) =>
            !entry.dir &&
            !entry.name.startsWith('__MACOSX') &&
            /\.(txt|md|markdown|html|htm)$/i.test(entry.name)
        );
        for (const entry of entries) {
          const text = await entry.async('string');
          const cleanName = entry.name.split('/').pop() || entry.name;
          processTextEntry(cleanName, text);
        }
      } catch (err) {
        console.error('Failed to read zip archive:', err);
      }
    } else {
      const text = await file.text();
      processTextEntry(file.name, text);
    }
  }

  return results;
}
