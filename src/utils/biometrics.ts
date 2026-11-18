// Unified Biometric Authentication Utility for macOS (Touch ID), Android (Fingerprint / Face Unlock), and Web (WebAuthn)
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

  // 3. Check WebAuthn Platform Authenticator
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          return { isAvailable: true, biometryType: 'webauthn', label: 'Touch ID / Windows Hello' };
        }
      }
    } catch (_) {}
  }

  return { isAvailable: false, biometryType: 'none', label: 'None' };
}

/**
 * Prompt user for Biometric Authentication (Touch ID, Fingerprint, Face ID).
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
      const res = await win.Capacitor.Plugins.BiometricAuth?.authenticate({ reason });
      return { success: Boolean(res?.success), error: res?.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Biometric authentication failed' };
    }
  }

  // 3. WebAuthn Platform Authenticator
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      // Create a lightweight client challenge to trigger platform biometric verification
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'preferred',
          rpId: window.location.hostname || undefined,
        },
      } as any);

      if (credential) {
        return { success: true };
      }
    } catch (err: any) {
      // User cancelled or not enrolled
      return { success: false, error: err?.message || 'Biometric verification cancelled' };
    }
  }

  return { success: false, error: 'Biometric authentication is not supported on this platform' };
}

