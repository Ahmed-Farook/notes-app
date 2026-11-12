import JSZip from 'jszip';
import { Note } from '../types/note';

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
      return `${inner.replace(/\n+$/, '')}\n\n`;
    }

    if (
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'p' ||
      tag === 'div'
    ) {
      // An empty <p></p> represents a blank line break
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

  // Normalize excessive newlines (>3 -> 2) and trim edges
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
 * Formats a note into string content and file extension based on chosen export format.
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
  return (name || 'Untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Untitled';
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
 * Exports a single note directly.
 */
export function exportSingleNote(note: Note, formatType: 'markdown' | 'txt' | 'html'): void {
  const { content, ext, mimeType } = formatNoteForExport(note, formatType);
  const filename = `${sanitizeFilename(note.title || 'Untitled')}.${ext}`;
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Bundles multiple selected notes into a single downloadable .zip archive.
 */
export async function exportNotesAsZip(
  notesToExport: Note[],
  formatType: 'markdown' | 'txt' | 'html' = 'txt'
): Promise<void> {
  if (notesToExport.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const note of notesToExport) {
    const { content, ext } = formatNoteForExport(note, formatType);
    const baseName = sanitizeFilename(note.title || 'Untitled');
    const count = usedNames.get(baseName.toLowerCase()) || 0;
    usedNames.set(baseName.toLowerCase(), count + 1);
    const uniqueName = count === 0 ? `${baseName}.${ext}` : `${baseName} (${count + 1}).${ext}`;
    zip.file(uniqueName, content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(zipBlob, `texo-notes-${dateStr}.zip`);
}

/**
 * Converts plain text (with \n line breaks) into TipTap HTML + title + preview.
 */
export function plainTextToNotePayload(
  rawText: string,
  filenameWithoutExt?: string
): { title: string; content: string; plainTextPreview: string } {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);

  const title =
    nonEmpty.length > 0
      ? nonEmpty[0].substring(0, 80)
      : (filenameWithoutExt || 'Imported Note').substring(0, 80);

  const plainTextPreview =
    nonEmpty.length > 1
      ? nonEmpty.slice(1).join(' ').substring(0, 150)
      : nonEmpty.length === 1 && nonEmpty[0] !== title
      ? nonEmpty[0].substring(0, 150)
      : 'No additional text';

  // Convert lines into TipTap paragraphs: first non-empty line becomes <h1> if matching title
  let usedHeading = false;
  const htmlParts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      htmlParts.push('<p></p>');
    } else if (!usedHeading && trimmed.substring(0, 80) === title) {
      usedHeading = true;
      htmlParts.push(`<h1>${escapeHtml(line)}</h1>`);
    } else {
      htmlParts.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  return {
    title,
    content: htmlParts.join('') || '<h1>Imported Note</h1><p></p>',
    plainTextPreview,
  };
}

/**
 * Converts simple Markdown into TipTap-compatible HTML + title + preview.
 */
export function markdownToNotePayload(
  rawMd: string,
  filenameWithoutExt?: string
): { title: string; content: string; plainTextPreview: string } {
  const normalized = rawMd.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const htmlParts: string[] = [];
  const plainLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      htmlParts.push('<p></p>');
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4);
      plainLines.push(text);
      htmlParts.push(`<h3>${escapeHtml(text)}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3);
      plainLines.push(text);
      htmlParts.push(`<h2>${escapeHtml(text)}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      const text = trimmed.slice(2);
      plainLines.push(text);
      htmlParts.push(`<h1>${escapeHtml(text)}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      const text = trimmed.slice(2);
      plainLines.push(text);
      htmlParts.push(`<blockquote><p>${escapeHtml(text)}</p></blockquote>`);
    } else {
      plainLines.push(trimmed);
      let formatted = escapeHtml(line)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
      htmlParts.push(`<p>${formatted}</p>`);
    }
  }

  const title =
    plainLines.length > 0
      ? plainLines[0].substring(0, 80)
      : (filenameWithoutExt || 'Imported Note').substring(0, 80);
  const plainTextPreview =
    plainLines.length > 1 ? plainLines.slice(1).join(' ').substring(0, 150) : 'No additional text';

  return {
    title,
    content: htmlParts.join('') || '<h1>Imported Note</h1><p></p>',
    plainTextPreview,
  };
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
