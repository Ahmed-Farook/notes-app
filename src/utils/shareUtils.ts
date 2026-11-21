import { Capacitor } from '@capacitor/core';
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { supabase } from '../lib/supabase';

export interface SharedNoteData {
  title: string;
  content: string;
  strokes?: string;
}

const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateShareSlug(length: number = 7): string {
  let slug = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      slug += SLUG_ALPHABET[randomBytes[i] % SLUG_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      slug += SLUG_ALPHABET.charAt(Math.floor(Math.random() * SLUG_ALPHABET.length));
    }
  }
  return slug;
}

/**
 * Creates a short, clean shareable link via Supabase `shared_notes` table.
 * Returns a 35-character URL like `https://texo-notes.vercel.app/s/x7K9pQ`.
 * Falls back safely to compressed URL hash if offline or on network error.
 */
export async function createSupabaseShareLink(note: {
  title?: string;
  content?: string;
  drawingStrokes?: string;
}): Promise<{ url: string; slug: string; isCloudSlug: boolean }> {
  const fallbackUrl = buildShareUrl(note);

  // If completely offline or running without network
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { url: fallbackUrl, slug: '', isCloudSlug: false };
  }

  try {
    const slug = generateShareSlug(7);
    const cleanTitle = note.title?.trim() || 'Shared Note';
    const cleanContent = note.content || '';
    const cleanStrokes = note.drawingStrokes || null;

    // Get current auth user ID if available (optional)
    let currentUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData?.user?.id || null;
    } catch (_) {}

    const { error } = await supabase.from('shared_notes').insert([
      {
        slug,
        title: cleanTitle,
        content: cleanContent,
        strokes: cleanStrokes,
        user_id: currentUserId,
      },
    ]);

    if (error) {
      console.warn('Supabase shared_notes insert warning:', error.message);
      // Fallback to client-side compressed hash link
      return { url: fallbackUrl, slug: '', isCloudSlug: false };
    }

    let base = 'https://texo-notes.vercel.app';
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin && origin.startsWith('http') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        base = origin.replace(/\/$/, '');
      }
    }

    return {
      url: `${base}/s/${slug}`,
      slug,
      isCloudSlug: true,
    };
  } catch (err) {
    console.warn('Failed to create Supabase share link, falling back to URL payload:', err);
    return { url: fallbackUrl, slug: '', isCloudSlug: false };
  }
}

/**
 * Fetches a public shared note by its short slug from Supabase.
 */
export async function fetchSharedNoteFromSupabase(slug: string): Promise<SharedNoteData | null> {
  if (!slug || !slug.trim()) return null;
  const cleanSlug = slug.trim();

  try {
    const { data, error } = await supabase
      .from('shared_notes')
      .select('title, content, strokes')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error || !data) {
      console.warn('Shared note lookup failed or not found for slug:', cleanSlug, error);
      return null;
    }

    return {
      title: data.title || 'Shared Note',
      content: data.content || '',
      strokes: data.strokes || undefined,
    };
  } catch (err) {
    console.warn('Error fetching shared note from Supabase:', err);
    return null;
  }
}

/**
 * Detects if the current URL contains a short slug (/s/<slug> or ?s=<slug>).
 */
export function getShareSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (Capacitor.isNativePlatform()) return null;

  try {
    // 1. Path format: /s/<slug> or /share/<slug>
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/(?:s|share)\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1] && match[1].length <= 20) {
      return match[1].trim();
    }

    // 2. Query param: ?s=<slug> or ?share=<slug> (short, alphanumeric)
    const params = new URLSearchParams(window.location.search);
    const paramSlug = params.get('s') || params.get('slug');
    if (paramSlug && paramSlug.length <= 16 && /^[a-zA-Z0-9_-]+$/.test(paramSlug)) {
      return paramSlug.trim();
    }

    // 3. Hash format: #s=<slug> (short, alphanumeric, not a base64 block)
    const hash = window.location.hash;
    if (hash.startsWith('#s=') || hash.startsWith('#/s/')) {
      const hashVal = hash.replace(/^#(?:\/s\/|s=)/, '').split('&')[0];
      if (hashVal && hashVal.length <= 16 && /^[a-zA-Z0-9_-]+$/.test(hashVal)) {
        return hashVal.trim();
      }
    }
  } catch (_) {}

  return null;
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
