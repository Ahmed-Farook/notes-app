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

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!error && session) {
        setSession(session);
        setUser(session.user);
      }
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session ? session.user : null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setIsAuthModalOpen(false);
    }
    setSyncStatus('synced');
    return { error: null, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    setSyncStatus('syncing');
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSyncStatus('synced');
  }, []);

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

