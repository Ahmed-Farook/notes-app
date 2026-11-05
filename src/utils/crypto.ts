// Web Crypto API Zero-Knowledge End-to-End Encryption (E2EE)
// Uses PBKDF2 (SHA-256) for Key Derivation and AES-GCM (256-bit) for Encryption

const ENCRYPTION_PREFIX = 'enc:v1:';
const PBKDF2_ITERATIONS = 100_000;

export function isEncrypted(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from the user's password and email/salt.
 */
export async function deriveKeyFromPassword(password: string, saltString: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const salt = enc.encode(saltString.toLowerCase().trim());

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable for secure local device persistence
    ['encrypt', 'decrypt']
  );
}

/**
 * Export CryptoKey to Base64 string for local device storage.
 */
export async function exportKeyToString(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(exported));
}

/**
 * Import CryptoKey from Base64 string.
 */
export async function importKeyFromString(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  return window.crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: "enc:v1:<base64-iv>:<base64-ciphertext>"
 */
export async function encryptText(plainText: string, key: CryptoKey | null): Promise<string> {
  if (!key || !plainText) return plainText;

  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    enc.encode(plainText)
  );

  const ivBase64 = bytesToBase64(iv);
  const cipherBase64 = bytesToBase64(new Uint8Array(ciphertextBuffer));

  return `${ENCRYPTION_PREFIX}${ivBase64}:${cipherBase64}`;
}

/**
 * Decrypt an AES-256-GCM ciphertext string.
 * If text is not encrypted (e.g. legacy notes), it returns the string as-is.
 */
export async function decryptText(cipherText: string, key: CryptoKey | null): Promise<string> {
  if (!key || !cipherText || !cipherText.startsWith(ENCRYPTION_PREFIX)) {
    return cipherText;
  }

  try {
    const parts = cipherText.slice(ENCRYPTION_PREFIX.length).split(':');
    if (parts.length !== 2) return cipherText;

    const iv = base64ToBytes(parts[0]);
    const cipherBytes = base64ToBytes(parts[1]);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      cipherBytes as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Failed to decrypt text (invalid key or corrupted data):', err);
    return '[🔒 Encrypted note - Please sign in to decrypt]';
  }
}

// Byte conversion helpers
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
