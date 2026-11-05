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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
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
