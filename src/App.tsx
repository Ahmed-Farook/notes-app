import React from 'react';
import { AuthProvider } from './store/AuthContext';
import { NotesProvider } from './store/NotesContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/Auth/AuthModal';

function App() {
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
