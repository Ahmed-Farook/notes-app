import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  deriveKeyFromPassword,
  exportKeyToString,
  importKeyFromString,
} from '../utils/crypto';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  encryptionKey: CryptoKey | null;
  isKeyUnlocked: boolean;
  unlockWithPassword: (password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isKeyUnlocked, setIsKeyUnlocked] = useState<boolean>(false);

  // Helper to load stored encryption key from local device storage
  const loadStoredKey = useCallback(async (userId: string) => {
    try {
      const savedKeyStr = localStorage.getItem(`apple_notes_e2ee_${userId}`);
      if (savedKeyStr) {
        const key = await importKeyFromString(savedKeyStr);
        setEncryptionKey(key);
        setIsKeyUnlocked(true);
        return key;
      }
    } catch (err) {
      console.warn('Error loading stored encryption key:', err);
    }
    setIsKeyUnlocked(false);
    return null;
  }, []);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!error && session) {
        setSession(session);
        setUser(session.user);
        await loadStoredKey(session.user.id);
      }
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session ? session.user : null);
      if (session?.user) {
        await loadStoredKey(session.user.id);
      } else {
        setEncryptionKey(null);
        setIsKeyUnlocked(false);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadStoredKey]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSyncStatus('syncing');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setSyncStatus('error');
      return { error };
    }

    // Derive Zero-Knowledge AES-GCM Key locally on this device
    try {
      const key = await deriveKeyFromPassword(password, email);
      setEncryptionKey(key);
      setIsKeyUnlocked(true);
      const exported = await exportKeyToString(key);
      localStorage.setItem(`apple_notes_e2ee_${data.user.id}`, exported);
    } catch (keyErr) {
      console.error('Failed to derive encryption key on sign-in:', keyErr);
    }

    setSession(data.session);
    setUser(data.user);
    setSyncStatus('synced');
    setIsAuthModalOpen(false);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setSyncStatus('syncing');

    // Verification landing page hosted on Vercel domain or current web origin
    const baseOrigin =
      typeof window !== 'undefined' &&
      window.location.protocol.startsWith('http') &&
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1')
        ? window.location.origin
        : 'https://texo-notes.vercel.app';

    const emailRedirectTo = `${baseOrigin}/verified.html`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });
    if (error) {
      setSyncStatus('error');
      return { error };
    }

    const needsEmailConfirmation = !data.session;
    if (data.session && data.user) {
      // Derive Zero-Knowledge AES-GCM Key locally on this device
      try {
        const key = await deriveKeyFromPassword(password, email);
        setEncryptionKey(key);
        setIsKeyUnlocked(true);
        const exported = await exportKeyToString(key);
        localStorage.setItem(`apple_notes_e2ee_${data.user.id}`, exported);
      } catch (keyErr) {
        console.error('Failed to derive encryption key on sign-up:', keyErr);
      }

      setSession(data.session);
      setUser(data.user);
      setIsAuthModalOpen(false);
    }
    setSyncStatus('synced');
    return { error: null, needsEmailConfirmation };
  }, []);

  const unlockWithPassword = useCallback(async (password: string) => {
    if (!user || !user.email) return false;
    try {
      const key = await deriveKeyFromPassword(password, user.email);
      setEncryptionKey(key);
      setIsKeyUnlocked(true);
      const exported = await exportKeyToString(key);
      localStorage.setItem(`apple_notes_e2ee_${user.id}`, exported);
      return true;
    } catch (err) {
      console.error('Failed to unlock notes with password:', err);
      return false;
    }
  }, [user]);

  const signOut = useCallback(async () => {
    setSyncStatus('syncing');
    if (user) {
      localStorage.removeItem(`apple_notes_e2ee_${user.id}`);
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setEncryptionKey(null);
    setIsKeyUnlocked(false);
    setSyncStatus('synced');
  }, [user]);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!user || !user.email) {
      return { error: new Error('User not logged in') };
    }
    setSyncStatus('syncing');
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      setSyncStatus('error');
      return { error };
    }

    try {
      // Re-derive Zero-Knowledge AES-GCM Key locally on this device with the new password
      const newKey = await deriveKeyFromPassword(newPassword, user.email);
      setEncryptionKey(newKey);
      setIsKeyUnlocked(true);
      const exported = await exportKeyToString(newKey);
      localStorage.setItem(`apple_notes_e2ee_${user.id}`, exported);
    } catch (keyErr) {
      console.error('Failed to derive encryption key on password change:', keyErr);
    }

    if (data.user) {
      setUser(data.user);
    }
    setSyncStatus('synced');
    return { error: null };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) {
      return { error: new Error('User not logged in') };
    }
    setSyncStatus('syncing');

    try {
      // 1. Delete user notes from cloud via RLS
      const { error: notesErr } = await supabase.from('notes').delete().eq('user_id', user.id);
      if (notesErr) console.warn('Failed deleting notes table:', notesErr);

      // 2. Delete user custom folders from cloud via RLS
      const { error: foldersErr } = await supabase.from('folders').delete().eq('user_id', user.id);
      if (foldersErr) console.warn('Failed deleting folders table:', foldersErr);

      // 3. Delete user account from Supabase auth.users via delete_user RPC
      const { error: rpcError } = await supabase.rpc('delete_user');
      if (rpcError) {
        console.error('RPC delete_user failed:', rpcError);
        setSyncStatus('error');
        const isNotFound = rpcError.message?.includes('Could not find') || rpcError.code === 'PGRST202';
        return {
          error: new Error(
            isNotFound
              ? 'Could not remove user from auth.users: The delete_user() function is not installed in your Supabase project. Please run supabase/schema.sql in your Supabase SQL Editor.'
              : `Failed to remove user from database: ${rpcError.message}`
          ),
        };
      }

      // 4. Remove local Zero-Knowledge E2EE key
      localStorage.removeItem(`apple_notes_e2ee_${user.id}`);

      // 5. Sign out and clear local session state
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setEncryptionKey(null);
      setIsKeyUnlocked(false);
      setSyncStatus('synced');
      return { error: null };
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      setSyncStatus('error');
      return { error: err };
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        syncStatus,
        setSyncStatus,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        encryptionKey,
        isKeyUnlocked,
        unlockWithPassword,
        signIn,
        signUp,
        signOut,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
