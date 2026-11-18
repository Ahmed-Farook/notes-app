import React, { useState, useEffect } from 'react';
import { AuthProvider } from './store/AuthContext';
import { NotesProvider } from './store/NotesContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/Auth/AuthModal';
import { SharedNoteView } from './components/Share/SharedNoteView';

function getSharePayloadFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check query parameter: ?share=<payload>
  const params = new URLSearchParams(window.location.search);
  const shareParam = params.get('share');
  if (shareParam) return shareParam;

  // 2. Check hash: #share=<payload> or #data=<payload>
  const hash = window.location.hash;
  if (hash.includes('share=')) {
    return hash.split('share=')[1]?.split('&')[0] || null;
  }
  if (hash.includes('data=')) {
    return hash.split('data=')[1]?.split('&')[0] || null;
  }

  return null;
}

function App() {
  const [sharePayload, setSharePayload] = useState<string | null>(() => getSharePayloadFromUrl());

  useEffect(() => {
    const handlePopState = () => {
      setSharePayload(getSharePayloadFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleExitSharedView = () => {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    setSharePayload(null);
  };

  if (sharePayload) {
    return <SharedNoteView payloadStr={sharePayload} onExit={handleExitSharedView} />;
  }

  return (
    <AuthProvider>
      <NotesProvider>
        <Layout />
        <AuthModal />
      </NotesProvider>
    </AuthProvider>
  );
}

export default App;
