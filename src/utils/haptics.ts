import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let lastHapticTimestamp = 0;
const MIN_HAPTIC_GAP_MS = 70;

/**
 * Triggers a subtle, ultra-light micro-tick on native mobile platforms.
 * Throttled cleanly so back-to-back calls never buzz excessively, and a no-op on Desktop/Web.
 */
export const triggerHaptic = async (style?: ImpactStyle) => {
  if (!Capacitor.isNativePlatform()) return;

  const now = Date.now();
  if (now - lastHapticTimestamp < MIN_HAPTIC_GAP_MS) return;
  lastHapticTimestamp = now;

  try {
    if (style && style !== ImpactStyle.Light) {
      await Haptics.impact({ style });
    } else {
      // Crisp, subtle selection tick instead of heavy vibration motor impact
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    }
  } catch {
    // Graceful fallback if device does not support haptics
  }
};
