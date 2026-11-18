import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Eye, EyeOff, KeyRound, X, Fingerprint } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { checkBiometricsAvailable, BiometricCheckResult } from '../../utils/biometrics';
import { Note } from '../../types/note';

interface LockNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  mode: 'lock' | 'unlock' | 'remove';
  onLockWithPassword: (password: string, hint?: string) => Promise<void>;
  onUnlockWithPassword: (password: string) => Promise<boolean>;
  onUnlockWithBiometrics?: () => Promise<boolean>;
  onRemovePassword: (password: string) => Promise<boolean>;
}

export const LockNoteModal: React.FC<LockNoteModalProps> = ({
  isOpen,
  onClose,
  note,
  mode,
  onLockWithPassword,
  onUnlockWithPassword,
  onUnlockWithBiometrics,
  onRemovePassword,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricCheckResult | null>(null);
  const hasAutoPromptedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasAutoPromptedRef.current = false;
      checkBiometricsAvailable().then((info) => {
        setBiometricInfo(info);
      });
    }
  }, [isOpen]);

  const handleBiometricUnlock = async () => {
    if (!onUnlockWithBiometrics) return;
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const ok = await onUnlockWithBiometrics();
      if (ok) {
        triggerHaptic();
        handleClose();
      } else {
        setErrorMsg('Biometric authentication cancelled or not recognized.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Automatically trigger biometrics once when opening an unlock modal if available
  useEffect(() => {
    if (isOpen && mode === 'unlock' && biometricInfo?.isAvailable && onUnlockWithBiometrics && !hasAutoPromptedRef.current) {
      hasAutoPromptedRef.current = true;
      handleBiometricUnlock();
    }
  }, [isOpen, mode, biometricInfo, onUnlockWithBiometrics]);

  if (!isOpen || !note) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password) {
      setErrorMsg('Please enter a password');
      return;
    }

    if (mode === 'lock') {
      if (password.length < 3) {
        setErrorMsg('Password must be at least 3 characters');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match');
        return;
      }

      setIsSubmitting(true);
      try {
        await onLockWithPassword(password, hint);
        triggerHaptic();
        handleClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to lock note');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'unlock') {
      setIsSubmitting(true);
      try {
        const success = await onUnlockWithPassword(password);
        if (success) {
          triggerHaptic();
          handleClose();
        } else {
          setErrorMsg('Incorrect password. Please try again.');
          triggerHaptic();
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to unlock note');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'remove') {
      setIsSubmitting(true);
      try {
        const success = await onRemovePassword(password);
        if (success) {
          triggerHaptic();
          handleClose();
        } else {
          setErrorMsg('Incorrect password. Cannot remove lock.');
          triggerHaptic();
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to remove password');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setHint('');
    setErrorMsg('');
    setShowPassword(false);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 select-none [app-region:no-drag]"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm my-auto max-h-[90vh] overflow-y-auto bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-apple-border dark:border-apple-borderDark p-5 animate-in zoom-in-95 duration-150 text-[#1C2B36] dark:text-[#E8EEF3] [app-region:no-drag]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-[#1C2B36] dark:text-[#E8EEF3]">
                {mode === 'lock'
                  ? 'Lock Note with Password'
                  : mode === 'unlock'
                  ? 'Unlock Note'
                  : 'Remove Note Lock'}
              </h3>
              <p className="text-[11px] text-[#6E8092] dark:text-[#8AA0B4] truncate max-w-[210px]">
                {note.title || 'Untitled Note'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-[#6E8092] dark:text-[#8AA0B4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {errorMsg && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2 animate-in fade-in duration-100">
              {errorMsg}
            </div>
          )}

          {mode === 'unlock' && biometricInfo?.isAvailable && (
            <div>
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isSubmitting}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <Fingerprint size={16} />
                <span>Unlock with {biometricInfo.label}</span>
              </button>
              <div className="flex items-center my-2 text-[10px] text-[#6E8092] dark:text-[#8AA0B4]">
                <div className="flex-1 h-px bg-[#DFD3C0] dark:bg-[#2C4054]" />
                <span className="px-2">or enter password</span>
                <div className="flex-1 h-px bg-[#DFD3C0] dark:bg-[#2C4054]" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#5A6E82] dark:text-[#8AA0B4] mb-1">
              {mode === 'lock' ? 'Choose Password' : 'Enter Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Enter password..."
                className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-white dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#2C4054] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:ring-2 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-white"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {mode === 'lock' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A6E82] dark:text-[#8AA0B4] mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#2C4054] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:ring-2 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#5A6E82] dark:text-[#8AA0B4] mb-1">
                  Password Hint <span className="font-normal opacity-70">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="e.g. Favorite book..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#2C4054] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:ring-2 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0] transition-all"
                />
              </div>
            </>
          )}

          {mode !== 'lock' && note.passwordHint && (
            <div className="text-[11px] text-[#6E8092] dark:text-[#8AA0B4] bg-[#EFE8DA] dark:bg-[#1A2530] px-3 py-1.5 rounded-lg border border-[#DFD3C0] dark:border-[#263747]">
              <span className="font-semibold">Hint:</span> {note.passwordHint}
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#6E8092] dark:text-[#8AA0B4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] ${
                mode === 'remove'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-apple-yellow hover:bg-apple-yellowHover dark:bg-[#2C4A68] dark:hover:bg-[#345A7D]'
              }`}
            >
              <KeyRound size={13} />
              <span>
                {mode === 'lock'
                  ? 'Lock Note'
                  : mode === 'unlock'
                  ? 'Unlock Note'
                  : 'Remove Lock'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
