import React from 'react';
import { NotesProvider } from './store/NotesContext';
import { Layout } from './components/Layout';

function App() {
  return (
    <NotesProvider>
      <Layout />
    </NotesProvider>
  );
}

export default App;
