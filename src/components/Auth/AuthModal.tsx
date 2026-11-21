import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  X,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Key,
  Trash2,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useNotes } from '../../store/NotesContext';
import { triggerHaptic } from '../../utils/haptics';
import { TexoLogo } from '../common/TexoLogo';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signIn,
    signUp,
    user,
    signOut,
    isKeyUnlocked,
    unlockWithPassword,
    changePassword,
    deleteAccount,
    syncStatus,
  } = useAuth();
  const { syncWithCloud } = useNotes();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Change Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Delete Account confirmation state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    const ok = await unlockWithPassword(unlockPassword);
    setIsLoading(false);
    if (!ok) {
      setErrorMsg('Invalid password. Unable to unlock encryption key.');
    } else {
      setUnlockPassword('');
      setSuccessMsg('Notes unlocked successfully!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    triggerHaptic();
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          closeAuthModal();
        }
      } else {
        const { error, needsEmailConfirmation } = await signUp(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        } else if (needsEmailConfirmation) {
          setSuccessMsg('Account created! Please check your email to confirm your account, then sign in.');
          setMode('signin');
        } else {
          closeAuthModal();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    triggerHaptic();
    setIsLoading(true);
    await signOut();
    setIsLoading(false);
    closeAuthModal();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    triggerHaptic();
    setIsLoading(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Password updated successfully!');
        setNewPassword('');
        setConfirmNewPassword('');
        setIsChangingPassword(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    triggerHaptic();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await deleteAccount();
      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsConfirmingDelete(false);
        closeAuthModal();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete account.');
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 [app-region:no-drag]">
      <div
        className="w-full max-w-sm max-h-[90vh] bg-[#FAF6EF] dark:bg-[#16202A] rounded-2xl shadow-2xl border border-apple-border dark:border-apple-borderDark overflow-hidden flex flex-col text-[#1C2B36] dark:text-[#E8EEF3] animate-in zoom-in-95 duration-150 [app-region:no-drag]"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/80 dark:bg-[#131B24]/80 shrink-0">
          <div className="flex items-center space-x-2">
            <TexoLogo size={18} />
            <h3 className="text-sm font-semibold">
              {user ? 'Cloud Sync Account' : 'texō Cloud'}
            </h3>
          </div>
          <button
            onClick={closeAuthModal}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {user ? (
            /* Logged in state */
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-colors bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                {syncStatus === 'syncing' ? (
                  <Loader2 size={26} className="text-amber-500 animate-spin" />
                ) : syncStatus === 'error' ? (
                  <AlertCircle size={26} className="text-red-500" />
                ) : (
                  <CheckCircle2 size={26} />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">
                  {syncStatus === 'syncing'
                    ? 'Syncing with Cloud...'
                    : syncStatus === 'error'
                    ? 'Sync Needs Attention'
                    : 'Cloud Sync is Active'}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-xs mx-auto">
                  Signed in as <span className="font-medium text-neutral-800 dark:text-neutral-200">{user.email}</span>
                </p>

                {/* Sync Now Action Card */}
                <div className="pt-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60">
                    <div className="flex items-center space-x-2 text-left">
                      <Cloud
                        size={16}
                        className={
                          syncStatus === 'syncing'
                            ? 'text-amber-500 animate-pulse'
                            : syncStatus === 'error'
                            ? 'text-red-500'
                            : 'text-emerald-500'
                        }
                      />
                      <div className="text-xs">
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {syncStatus === 'syncing'
                            ? 'Syncing notes & checklists...'
                            : syncStatus === 'error'
                            ? 'Sync issue encountered'
                            : 'All changes synced'}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          Cross-platform (Web, Android, Desktop)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isManualSyncing || syncStatus === 'syncing'}
                      onClick={async () => {
                        triggerHaptic();
                        setIsManualSyncing(true);
                        await syncWithCloud(true, true);
                        setIsManualSyncing(false);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-apple-yellow text-white hover:bg-apple-yellowHover active:scale-95 transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isManualSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''} />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  {isKeyUnlocked ? (
                    <div className="inline-flex items-center space-x-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 py-1.5 px-3 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span>Zero-Knowledge E2EE Active (AES-256)</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2 text-left">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                        <KeyRound size={14} />
                        <span>Unlock Encrypted Notes</span>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                        Enter your account password on this device to decrypt your notes:
                      </p>
                      <form onSubmit={handleUnlock} className="space-y-2 pt-1">
                        <input
                          type="password"
                          required
                          placeholder="Your account password"
                          value={unlockPassword}
                          onChange={(e) => setUnlockPassword(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                        />
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-1.5 bg-apple-yellow text-white rounded-lg text-xs font-semibold hover:bg-apple-yellowHover transition-colors"
                        >
                          {isLoading ? 'Unlocking...' : 'Unlock Notes'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 pt-1 leading-relaxed">
                  Your notes and checklists are encrypted end-to-end. Nobody — not even the database admin — can read them.
                </p>
              </div>

              {/* Status alerts inside logged-in view */}
              {errorMsg && (
                <div className="flex items-start space-x-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 text-left">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start space-x-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 text-left">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Change Password Collapsible Section */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-left bg-black/[0.02] dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(!isChangingPassword);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Key size={14} className="text-neutral-500" />
                    <span>Change Password</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-neutral-400 transition-transform ${isChangingPassword ? 'rotate-180' : ''}`}
                  />
                </button>
                {isChangingPassword && (
                  <form onSubmit={handleChangePassword} className="p-3 pt-1 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5">
                    <input
                      type="password"
                      required
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                    />
                    <input
                      type="password"
                      required
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-1.5 bg-apple-yellow text-white rounded-lg text-xs font-semibold hover:bg-apple-yellowHover transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <span>Update Password</span>}
                    </button>
                  </form>
                )}
              </div>

              {/* Action Buttons: Sign Out and Delete Account */}
              {!isConfirmingDelete ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleSignOut}
                    disabled={isLoading}
                    className="w-full py-2 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Signing Out...' : 'Sign Out'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingDelete(true);
                      setErrorMsg(null);
                    }}
                    className="w-full py-2 px-4 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Delete Account</span>
                  </button>
                </div>
              ) : (
                /* Delete Account Confirmation Dialog */
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2.5 text-left animate-in fade-in duration-150">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    <Trash2 size={15} />
                    <span>Permanently Delete Account?</span>
                  </div>
                  <p className="text-[11px] text-red-600/90 dark:text-red-400/90 leading-relaxed">
                    This will permanently delete all your encrypted notes and folders from the cloud server and sign you out. This action cannot be undone.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleDeleteAccount}
                      className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <span>Yes, Delete Account</span>}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Sign in / Sign up form */
            <>
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-1">
                  <TexoLogo size={36} />
                </div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {mode === 'signin' ? 'Sign in to texō' : 'Create Free Sync Account'}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Instant real-time sync between your Mac, Android, and Web devices.
                </p>
              </div>

              {/* Mode Tabs */}
              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Success / Error alerts */}
              {errorMsg && (
                <div className="flex items-start space-x-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start space-x-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:border-apple-yellow"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-apple-yellow hover:bg-apple-yellowHover active:scale-98 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-60 mt-1"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>{mode === 'signin' ? 'Sign In' : 'Create Free Account'}</span>
                  )}
                </button>
              </form>

              <p className="text-[10px] text-center text-neutral-400 leading-relaxed">
                🛡️ <strong>Zero-Knowledge:</strong> Notes are encrypted with AES-256 on your device before syncing. Even the database admin cannot read your notes.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

