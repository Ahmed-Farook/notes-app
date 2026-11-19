import { Capacitor } from '@capacitor/core';
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export interface SharedNoteData {
  title: string;
  content: string;
  strokes?: string;
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates a highly compressed, URL-safe base64 string for sharing a note.
 */
export function createSharePayload(note: { title?: string; content?: string; drawingStrokes?: string }): string {
  try {
    const compact = note.drawingStrokes
      ? [note.title || '', note.content || '', note.drawingStrokes]
      : [note.title || '', note.content || ''];
    const jsonStr = JSON.stringify(compact);
    const u8 = strToU8(jsonStr);
    const compressed = deflateSync(u8, { level: 9 });
    return uint8ToBase64Url(compressed);
  } catch (e) {
    console.warn('Payload compression fallback:', e);
    const fallback = JSON.stringify({
      title: note.title || '',
      content: note.content || '',
      strokes: note.drawingStrokes || undefined,
    });
    return btoa(unescape(encodeURIComponent(fallback)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

/**
 * Builds the full share URL with compact hash fragment.
 */
export function buildShareUrl(note: { title?: string; content?: string; drawingStrokes?: string }): string {
  const payload = createSharePayload(note);

  let base = '';
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && origin.startsWith('http') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      base = origin;
    }
  }
  if (!base) {
    base = 'https://texo-notes.vercel.app';
  }

  base = base.replace(/\/$/, '');
  const path = (typeof window !== 'undefined' && window.location.pathname !== '/' && !window.location.pathname.endsWith('.html'))
    ? window.location.pathname.replace(/\/$/, '')
    : '';

  return `${base}${path}/#s=${payload}`;
}

/**
 * Extracts raw share payload from URL hash or query parameters.
 */
export function getSharePayloadFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (Capacitor.isNativePlatform()) return null;

  try {
    // 1. Check hash fragment: #s=<payload> or #share=<payload>
    const hash = window.location.hash;
    if (hash.includes('s=')) {
      const val = hash.split('s=')[1]?.split('&')[0];
      if (val && val.trim()) return val.trim();
    }
    if (hash.includes('share=')) {
      const val = hash.split('share=')[1]?.split('&')[0];
      if (val && val.trim()) return val.trim();
    }
    if (hash.includes('data=')) {
      const val = hash.split('data=')[1]?.split('&')[0];
      if (val && val.trim()) return val.trim();
    }

    // 2. Check query parameter: ?s=<payload> or ?share=<payload>
    const params = new URLSearchParams(window.location.search);
    const sParam = params.get('s') || params.get('share');
    if (sParam && sParam.trim()) {
      return sParam.trim();
    }
  } catch (_) {}

  return null;
}

/**
 * Decodes compressed or legacy note payload safely across all formats.
 */
export function parseSharedPayload(payloadStr: string): SharedNoteData | null {
  if (!payloadStr) return null;
  const cleanStr = payloadStr.trim();

  // 1. Try compressed base64url format
  try {
    const bytes = base64UrlToUint8(cleanStr);
    const decompressed = inflateSync(bytes);
    const jsonStr = strFromU8(decompressed);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return {
        title: parsed[0] || 'Shared Note',
        content: parsed[1] || '',
        strokes: parsed[2] || undefined,
      };
    }
  } catch (_) {}

  // 2. Try legacy uncompressed base64 JSON array or object
  try {
    let raw = cleanStr;
    try {
      raw = decodeURIComponent(cleanStr);
    } catch (_) {}
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
    let jsonStr = '';
    try {
      jsonStr = decodeURIComponent(escape(atob(base64)));
    } catch (_) {
      jsonStr = atob(base64);
    }
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return {
        title: parsed[0] || 'Shared Note',
        content: parsed[1] || '',
        strokes: parsed[2] || undefined,
      };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        title: parsed.title || 'Shared Note',
        content: parsed.content || '',
        strokes: parsed.strokes || undefined,
      };
    }
  } catch (_) {}

  return null;
}

/**
 * Cleans share parameters from the URL without triggering a page reload.
 */
export function cleanShareUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    url.searchParams.delete('share');

    let newHash = window.location.hash;
    if (newHash.includes('s=') || newHash.includes('share=')) {
      newHash = newHash
        .replace(/#?[s|share]=[^&]*&?/, '')
        .replace(/^#$/, '');
    }

    const cleanPath = url.pathname + (url.search ? url.search : '') + (newHash ? '#' + newHash : '');
    window.history.replaceState({}, '', cleanPath || '/');
  } catch (_) {}
}
