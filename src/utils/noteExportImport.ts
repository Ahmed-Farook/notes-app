import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import katex from 'katex';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
 * Triggers browser download of a Blob as an <a> download fallback.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Universal export delivery handler supporting:
 * 1. Capacitor Native Android & iOS (saves to device cache and summons native Share / Save sheet)
 * 2. Mobile web browsers (uses Web Share API if supported)
 * 3. Desktop / Web browser standard download
 */
export async function saveOrShareBlob(blob: Blob, filename: string): Promise<void> {
  // 1. Capacitor Native App on Android or iOS
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
        };
        reader.readAsDataURL(blob);
      });

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: `Export ${filename}`,
      });
      return;
    } catch (nativeErr) {
      console.warn('Capacitor native export failed, falling back to browser download:', nativeErr);
    }
  }

  // 2. Mobile Web Browsers (Safari / Chrome Mobile) with Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      }
    } catch (shareErr) {
      if ((shareErr as any)?.name === 'AbortError') {
        return; // User intentionally dismissed the share sheet
      }
    }
  }

  // 3. Desktop / standard web fallback
  downloadBlob(blob, filename);
}

/**
 * Renders both formatted note text/checklists/tables/images, mathematical formulas,
 * and handwritten InNoteCanvas strokes into a clean, well-spaced, multi-page A4 PDF Blob.
 * 
 * Logic Highlights:
 * 1. Uses editor-faithful typography & spacing instead of separate incompatible PDF styling.
 * 2. Preserves natural word spacing and line wrapping (no artificial non-breaking spaces).
 * 3. Does NOT force first block to H1; keeps authentic user note structure.
 * 4. Calculates intelligent page breaks between lines & elements (avoiding slicing through text,
 *    images, tables, or formulas, and preventing orphan headings).
 * 5. Captures one page at a time to prevent massive oversized canvases and blank pages on mobile.
 */
export async function generateNotePdfBlob(note: Note): Promise<Blob> {
  const pageWidthPx = 720;
  // A4 dimensions: 210mm x 297mm with 15mm margins on all sides.
  // Printable area: 180mm x 267mm -> Aspect ratio = 267 / 180 ≈ 1.4833
  const pageHeightPx = Math.floor(pageWidthPx * (267 / 180)); // 1068px

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = `${pageWidthPx}px`;
  host.style.backgroundColor = '#FFFFFF';
  host.style.color = '#1C2B36';
  host.style.padding = '0';
  host.style.margin = '0';
  host.style.boxSizing = 'border-box';
  host.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  host.style.zIndex = '-99999';
  host.style.opacity = '1';
  host.style.pointerEvents = 'none';

  // Scoped typography styles matching the editor faithfully
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .prose-print {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: 1.625;
      color: #1C2B36;
      background-color: #FFFFFF;
      padding: 0;
      margin: 0;
      width: 100%;
      word-wrap: break-word;
    }
    .prose-print * {
      box-sizing: border-box;
    }
    .prose-print h1 {
      font-size: 28px;
      line-height: 1.25;
      font-weight: 700;
      margin-top: 6px;
      margin-bottom: 14px;
      letter-spacing: -0.025em;
      color: #1C2B36;
      word-break: break-word;
    }
    .prose-print h2 {
      font-size: 20px;
      line-height: 1.35;
      font-weight: 600;
      margin-top: 18px;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
      color: #1C2B36;
      word-break: break-word;
    }
    .prose-print h3 {
      font-size: 17px;
      line-height: 1.4;
      font-weight: 600;
      margin-top: 14px;
      margin-bottom: 6px;
      color: #1C2B36;
      word-break: break-word;
    }
    .prose-print p {
      font-size: 15px;
      line-height: 1.625;
      margin-top: 0;
      margin-bottom: 8px;
      color: #1C2B36;
      min-height: 1.5em;
      word-break: break-word;
    }
    .prose-print ul:not([data-type="taskList"]) {
      list-style-type: disc;
      padding-left: 24px;
      margin-top: 4px;
      margin-bottom: 12px;
    }
    .prose-print ol {
      list-style-type: decimal;
      padding-left: 24px;
      margin-top: 4px;
      margin-bottom: 12px;
    }
    .prose-print li {
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 4px;
    }
    .prose-print blockquote {
      border-left: 3px solid #213A50;
      padding-left: 14px;
      margin: 12px 0;
      font-style: italic;
      color: #395060;
    }
    .prose-print pre {
      background: #192531;
      color: #F8FAFC;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      padding: 12px 14px;
      border-radius: 8px;
      margin: 12px 0;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .prose-print code:not(pre code) {
      background: #E8F1F7;
      color: #213A50;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 13px;
      font-family: ui-monospace, monospace;
    }
    .prose-print mark {
      background: #FEF08A;
      color: #1C2B36;
      padding: 1px 3px;
      border-radius: 3px;
    }
    .prose-print hr {
      border: none;
      border-top: 1px solid #DFD3C0;
      margin: 16px 0;
    }
    .prose-print table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      border: 1px solid #CBD5E1;
      font-size: 14px;
    }
    .prose-print th {
      background: #F1F5F9;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      border: 1px solid #CBD5E1;
      color: #1C2B36;
    }
    .prose-print td {
      padding: 8px 12px;
      border: 1px solid #CBD5E1;
      color: #1C2B36;
      vertical-align: top;
    }
    .prose-print img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 12px 0;
      display: block;
    }
    .prose-print .katex-math-block {
      margin: 14px 0;
      padding: 10px 14px;
      text-align: center;
      background: #F8FAFC;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
      color: #1C2B36;
    }
    .prose-print ul[data-type="taskList"] {
      list-style: none;
      padding: 0;
      margin: 6px 0 10px 0;
    }
    .prose-print ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      margin-bottom: 6px;
      font-size: 15px;
      line-height: 1.5;
    }
    .prose-print ul[data-type="taskList"] li > div {
      flex: 1 1 auto;
      min-width: 1px;
    }
    .prose-print ul[data-type="taskList"] li > div > p {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.5 !important;
      min-height: 1.5em !important;
    }
  `;
  host.appendChild(styleEl);

  const contentLayer = document.createElement('div');
  contentLayer.className = 'tiptap ProseMirror prose prose-neutral prose-print';
  contentLayer.style.position = 'relative';
  contentLayer.style.width = '100%';
  contentLayer.style.backgroundColor = '#FFFFFF';
  contentLayer.style.color = '#1C2B36';

  const proseLayer = document.createElement('div');
  proseLayer.innerHTML = note.content || '<p></p>';

  // Render mathematical formulas with KaTeX
  proseLayer.querySelectorAll('[data-type="math-block"]').forEach((el) => {
    const latex = el.getAttribute('data-latex') || el.textContent || '';
    if (latex) {
      try {
        el.innerHTML = katex.renderToString(latex, { displayMode: true, throwOnError: false });
        el.className = 'katex-math-block';
      } catch (_) {}
    }
  });

  proseLayer.querySelectorAll('p').forEach((p) => {
    const text = p.textContent?.trim() || '';
    const match = text.match(/^\$\$([\s\S]+?)\$\$$/) || text.match(/^\\\[([\s\S]+?)\\\]$/);
    if (match) {
      try {
        p.innerHTML = katex.renderToString(match[1].trim(), { displayMode: true, throwOnError: false });
        p.className = 'katex-math-block';
      } catch (_) {}
    }
  });

  // Render crisp vector SVG checklist items aligned with text line height
  proseLayer.querySelectorAll('li[data-type="taskItem"]').forEach((li) => {
    const isChecked =
      li.getAttribute('data-checked') === 'true' ||
      Boolean((li.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.checked);
    const label = li.querySelector(':scope > label');
    if (label) {
      const box = document.createElement('div');
      box.style.display = 'inline-flex';
      box.style.alignItems = 'center';
      box.style.justifyContent = 'center';
      box.style.width = '18px';
      box.style.height = '18px';
      box.style.minWidth = '18px';
      box.style.minHeight = '18px';
      box.style.marginRight = '10px';
      box.style.marginTop = '2px';
      box.style.borderRadius = '50%';
      box.style.flexShrink = '0';
      box.style.boxSizing = 'border-box';
      if (isChecked) {
        box.style.backgroundColor = '#213A50';
        box.style.border = '1.5px solid #213A50';
        box.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else {
        box.style.backgroundColor = 'transparent';
        box.style.border = '1.5px solid #C2B5A1';
      }
      label.replaceWith(box);
    }
    if (isChecked) {
      const textDiv = li.querySelector(':scope > div');
      if (textDiv) {
        (textDiv as HTMLElement).style.textDecoration = 'line-through';
        (textDiv as HTMLElement).style.color = '#8A99A8';
      }
    }
  });

  contentLayer.appendChild(proseLayer);
  host.appendChild(contentLayer);
  document.body.appendChild(host);

  // Parse handwritten drawing strokes if present
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

  try {
    const contentWidth = pageWidthPx;
    const contentHeight = Math.max(
      contentLayer.scrollHeight,
      maxStrokeY > 0 ? Math.ceil(maxStrokeY + 40) : 0
    );
    contentLayer.style.minHeight = `${contentHeight}px`;

    // Render handwritten strokes onto an aligned high-DPI canvas overlay
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
        const xScale = maxStrokeX > contentWidth ? contentWidth / maxStrokeX : 1;

        for (const stroke of parsedStrokes) {
          if (stroke.points.length === 0) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Map white/light dark-mode ink to Kyoto Indigo for clarity on white paper
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

    // Wait for all images inside the note to fully load
    const images = Array.from(host.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );

    // Wait for web fonts (including KaTeX math glyphs)
    await (document as any).fonts?.ready;

    // Measurement & Safe Boundary Detection
    const hostRect = contentLayer.getBoundingClientRect();
    const totalContentHeight = Math.max(
      contentLayer.scrollHeight,
      Math.ceil(hostRect.height),
      maxStrokeY > 0 ? Math.ceil(maxStrokeY + 40) : 0
    );

    interface ElementBoundary {
      top: number;
      bottom: number;
      isHeading: boolean;
      isAtomic: boolean;
    }

    const boundaries: ElementBoundary[] = [];
    const lineBottoms: number[] = [];

    const inspectElement = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const top = Math.round(rect.top - hostRect.top);
      const bottom = Math.round(rect.bottom - hostRect.top);
      const tag = el.tagName.toLowerCase();
      const isHeading = /^h[1-6]$/.test(tag);
      const isAtomic =
        tag === 'img' ||
        tag === 'tr' ||
        tag === 'li' ||
        el.classList.contains('katex-math-block') ||
        tag === 'pre';

      boundaries.push({ top, bottom, isHeading, isAtomic });

      // Collect line boxes for paragraphs, quotes, and list items
      if (tag === 'p' || tag === 'blockquote' || tag === 'li') {
        const clientRects = el.getClientRects();
        for (let c = 0; c < clientRects.length; c++) {
          const cr = clientRects[c];
          const lb = Math.round(cr.bottom - hostRect.top);
          if (lb > 0) {
            lineBottoms.push(lb);
          }
        }
      }
    };

    const allNodes = contentLayer.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, p, ul, ol, li, blockquote, pre, table, tr, img, .katex-math-block'
    );
    allNodes.forEach((node) => inspectElement(node as HTMLElement));

    // Calculate smart page slices so lines, tables, formulas & images are not sliced in half
    const slices: { startY: number; height: number }[] = [];
    let currentY = 0;

    while (currentY < totalContentHeight) {
      const remaining = totalContentHeight - currentY;
      if (remaining <= pageHeightPx) {
        slices.push({ startY: currentY, height: remaining });
        break;
      }

      const targetY = currentY + pageHeightPx;
      // We require at least 55% of the page to be filled before considering a break point
      const minBreakY = currentY + Math.floor(pageHeightPx * 0.55);

      let chosenBreakY = targetY;
      let foundSafeBreak = false;

      // 1. Check for headings near the bottom (prevent orphan headings) or atomic elements that cross targetY
      for (const b of boundaries) {
        if (b.isHeading && b.top >= targetY - 90 && b.top < targetY && b.top >= minBreakY) {
          chosenBreakY = b.top;
          foundSafeBreak = true;
          break;
        }

        if (b.isAtomic && b.top < targetY && b.bottom > targetY && b.top >= minBreakY) {
          chosenBreakY = b.top;
          foundSafeBreak = true;
          break;
        }
      }

      // 2. If no atomic break was needed, try to break cleanly between text lines
      if (!foundSafeBreak) {
        let bestLineBreak = -1;
        for (const lb of lineBottoms) {
          if (lb >= minBreakY && lb <= targetY - 4) {
            if (lb > bestLineBreak) {
              bestLineBreak = lb;
            }
          }
        }
        if (bestLineBreak > 0) {
          chosenBreakY = bestLineBreak + 2;
          foundSafeBreak = true;
        }
      }

      // 3. Fallback: find any element boundary in range
      if (!foundSafeBreak) {
        let bestElementBreak = -1;
        for (const b of boundaries) {
          if (b.bottom >= minBreakY && b.bottom <= targetY && b.bottom > bestElementBreak) {
            bestElementBreak = b.bottom;
          }
          if (b.top >= minBreakY && b.top <= targetY && b.top > bestElementBreak) {
            bestElementBreak = b.top;
          }
        }
        if (bestElementBreak > 0) {
          chosenBreakY = bestElementBreak;
          foundSafeBreak = true;
        }
      }

      const sliceHeight = Math.max(100, Math.min(pageHeightPx, chosenBreakY - currentY));
      slices.push({ startY: currentY, height: sliceHeight });
      currentY += sliceHeight;
    }

    // Generate PDF page by page (avoiding a single oversized canvas and preventing memory spikes/blank pages)
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm
    const marginMm = 15;
    const printWidth = pdfWidth - marginMm * 2; // 180 mm
    const printHeight = pdfHeight - marginMm * 2; // 267 mm

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      if (i > 0) {
        pdf.addPage();
      }

      const pageBox = document.createElement('div');
      pageBox.style.position = 'fixed';
      pageBox.style.left = '0';
      pageBox.style.top = '0';
      pageBox.style.width = `${pageWidthPx}px`;
      pageBox.style.height = `${slice.height}px`;
      pageBox.style.overflow = 'hidden';
      pageBox.style.backgroundColor = '#FFFFFF';
      pageBox.style.zIndex = '-99999';
      pageBox.style.pointerEvents = 'none';

      const pageContent = contentLayer.cloneNode(true) as HTMLElement;
      pageContent.style.position = 'absolute';
      pageContent.style.left = '0';
      pageContent.style.top = `-${slice.startY}px`;
      pageContent.style.width = `${pageWidthPx}px`;

      // Copy canvas drawing bitmaps to clone
      const origCanvases = contentLayer.querySelectorAll('canvas');
      const clonedCanvases = pageContent.querySelectorAll('canvas');
      origCanvases.forEach((orig, idx) => {
        const clone = clonedCanvases[idx];
        if (clone) {
          const cloneCtx = clone.getContext('2d');
          if (cloneCtx) {
            cloneCtx.drawImage(orig, 0, 0);
          }
        }
      });

      pageBox.appendChild(pageContent);
      document.body.appendChild(pageBox);

      try {
        const pageCanvas = await html2canvas(pageBox, {
          scale: 2,
          backgroundColor: '#FFFFFF',
          useCORS: true,
          logging: false,
          width: pageWidthPx,
          height: slice.height,
          windowWidth: pageWidthPx,
          windowHeight: slice.height,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = pageCanvas.toDataURL('image/png');
        const renderedMmHeight = (slice.height * printWidth) / pageWidthPx;
        pdf.addImage(imgData, 'PNG', marginMm, marginMm, printWidth, renderedMmHeight);
      } finally {
        if (pageBox.parentNode) {
          document.body.removeChild(pageBox);
        }
      }
    }

    return pdf.output('blob');
  } finally {
    if (host.parentNode) {
      document.body.removeChild(host);
    }
  }
}

/**
 * Exports a single note directly (including PDF with drawings) to download or native Share sheet.
 */
export async function exportSingleNote(
  note: Note,
  formatType: 'markdown' | 'txt' | 'html' | 'pdf'
): Promise<void> {
  const safeBase = sanitizeFilename(note.title || 'Untitled');
  if (formatType === 'pdf') {
    const pdfBlob = await generateNotePdfBlob(note);
    await saveOrShareBlob(pdfBlob, `${safeBase}.pdf`);
    return;
  }

  const { content, ext, mimeType } = formatNoteForExport(note, formatType);
  const blob = new Blob([content], { type: mimeType });
  await saveOrShareBlob(blob, `${safeBase}.${ext}`);
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
  await saveOrShareBlob(zipBlob, `texo-notes-${dateStr}.zip`);
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
