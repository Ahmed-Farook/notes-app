import { Capacitor } from '@capacitor/core';

export interface SharedNoteData {
  title: string;
  content: string;
  strokes?: string;
}

/**
 * Extracts raw share payload from URL search parameters or hash fragment.
 */
export function getSharePayloadFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // Native mobile app boots directly into local notes storage
  if (Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // 1. Check query parameter: ?share=<payload>
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (shareParam && shareParam.trim()) {
      return shareParam.trim();
    }

    // 2. Check hash fragment: #share=<payload> or #data=<payload>
    const hash = window.location.hash;
    if (hash.includes('share=')) {
      const val = hash.split('share=')[1]?.split('&')[0];
      if (val && val.trim()) return val.trim();
    }
    if (hash.includes('data=')) {
      const val = hash.split('data=')[1]?.split('&')[0];
      if (val && val.trim()) return val.trim();
    }
  } catch (_) {}

  return null;
}

/**
 * Decodes base64-encoded note payload safely across browsers and URL formats.
 */
export function parseSharedPayload(payloadStr: string): SharedNoteData | null {
  if (!payloadStr) return null;
  try {
    let str = payloadStr;
    try {
      str = decodeURIComponent(payloadStr);
    } catch (_) {}

    // In URL query parameters, '+' gets automatically converted to space ' '; restore them:
    const cleanBase64 = str.replace(/ /g, '+');

    let jsonStr = '';
    try {
      jsonStr = decodeURIComponent(escape(atob(cleanBase64)));
    } catch (_) {
      try {
        jsonStr = atob(cleanBase64);
      } catch (_) {
        jsonStr = str;
      }
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed && (typeof parsed.content === 'string' || typeof parsed.title === 'string')) {
      return {
        title: parsed.title || 'Untitled Shared Note',
        content: parsed.content || '',
        strokes: parsed.strokes || undefined,
      };
    }
  } catch (err) {
    console.warn('Failed to parse shared note payload:', err);
  }
  return null;
}

/**
 * Cleans the ?share= query param from browser URL without triggering a page reload.
 */
export function cleanShareUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');

    let newHash = window.location.hash;
    if (newHash.includes('share=')) {
      newHash = newHash.replace(/#?share=[^&]*&?/, '').replace(/^#$/, '');
    }

    const cleanPath = url.pathname + (url.search ? url.search : '') + (newHash ? '#' + newHash : '');
    window.history.replaceState({}, '', cleanPath || '/');
  } catch (_) {}
}

