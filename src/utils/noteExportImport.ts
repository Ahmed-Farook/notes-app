import JSZip from 'jszip';
import { generateNotePdfBlob } from './notePdf';
export { generateNotePdfBlob } from './notePdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Note } from '../types/note';
import { formatEditorDate } from './dateUtils';

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
