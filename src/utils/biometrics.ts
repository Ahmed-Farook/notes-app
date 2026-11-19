// Unified Biometric Authentication Utility for macOS (Touch ID), Android (Fingerprint / Face Unlock), and Web (WebAuthn Platform Touch ID)
import { Capacitor } from '@capacitor/core';

export interface BiometricCheckResult {
  isAvailable: boolean;
  biometryType: 'touchID' | 'fingerprint' | 'face' | 'webauthn' | 'none';
  label: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check whether biometric authentication (Touch ID, Fingerprint, Face ID) is supported on the current device.
 */
export async function checkBiometricsAvailable(): Promise<BiometricCheckResult> {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (!win) return { isAvailable: false, biometryType: 'none', label: 'None' };

  // 1. Check macOS Electron Touch ID
  if (win.electronAPI?.checkBiometrics && win.electronAPI?.isMac) {
    try {
      const isAvailable = await win.electronAPI.checkBiometrics();
      if (isAvailable) {
        return { isAvailable: true, biometryType: 'touchID', label: 'Touch ID' };
      }
    } catch (_) {}
  }

  // 2. Check Android Capacitor Native Biometrics
  if (Capacitor.isNativePlatform() || win.Capacitor?.Plugins?.BiometricAuth) {
    try {
      const res = await win.Capacitor.Plugins.BiometricAuth?.isAvailable();
      if (res?.isAvailable) {
        return { isAvailable: true, biometryType: 'fingerprint', label: 'Biometrics / Fingerprint' };
      }
    } catch (_) {}
  }

  // 3. Check WebAuthn Platform Authenticator (Touch ID on macOS / Windows Hello on PC)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const isMac = /Mac/i.test(navigator.userAgent);
          return {
            isAvailable: true,
            biometryType: 'webauthn',
            label: isMac ? 'Touch ID' : 'Windows Hello / Touch ID',
          };
        }
      }
    } catch (_) {}
  }

  return { isAvailable: false, biometryType: 'none', label: 'None' };
}

/**
 * Prompt user for Biometric Authentication (Touch ID, Fingerprint, Face ID).
 * Enforces native platform authenticator attachment so browsers never show "Scan QR or use security key".
 */
export async function promptBiometricAuth(reason: string = 'Unlock locked note'): Promise<BiometricAuthResult> {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (!win) return { success: false, error: 'Window not defined' };

  // 1. Electron macOS Touch ID
  if (win.electronAPI?.promptBiometrics && win.electronAPI?.isMac) {
    try {
      const res = await win.electronAPI.promptBiometrics(reason);
      return res;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Touch ID authentication failed' };
    }
  }

  // 2. Android Capacitor Native Biometrics
  if (Capacitor.isNativePlatform() || win.Capacitor?.Plugins?.BiometricAuth) {
    try {
      const BiometricPlugin = win.Capacitor?.Plugins?.BiometricAuth;
      if (!BiometricPlugin) {
        return { success: false, error: 'Biometric plugin not initialized' };
      }
      const res = await BiometricPlugin.authenticate({ reason });
      return { success: Boolean(res?.success), error: res?.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Biometric authentication failed' };
    }
  }

  // 3. WebAuthn Platform Authenticator (Forces Touch ID on Mac browser)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const storedCredId = localStorage.getItem('texo_webauthn_cred_id');

      // If we already have a registered platform passkey for this browser, authenticate with it
      if (storedCredId) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const credential = await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              userVerification: 'required',
              rpId: window.location.hostname || undefined,
              allowCredentials: [
                {
                  id: base64ToBuffer(storedCredId),
                  type: 'public-key',
                  transports: ['internal'],
                },
              ],
            },
          } as any);

          if (credential) {
            return { success: true };
          }
          return { success: false, error: 'Verification failed' };
        } catch (authErr: any) {
          // Authentication was dismissed or fingerprint failed - return failure immediately
          return { success: false, error: authErr?.message || 'Touch ID cancelled or not recognized' };
        }
      }

      // First time enrollment: register Touch ID using authenticatorAttachment: 'platform'
      // This strictly forces macOS Touch ID and completely avoids the QR / external security key modal!
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const newCred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'texō notes',
            id: window.location.hostname || undefined,
          },
          user: {
            id: userId,
            name: 'texo-user',
            displayName: 'texō User',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Crucial: Touch ID sensor only!
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      }) as any;

      if (newCred && newCred.rawId) {
        localStorage.setItem('texo_webauthn_cred_id', bufferToBase64(newCred.rawId));
        return { success: true };
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        return { success: false, error: 'Touch ID cancelled or timed out' };
      }
      return { success: false, error: err?.message || 'Touch ID verification failed' };
    }
  }

  return { success: false, error: 'Biometric authentication is not supported on this platform' };
}
