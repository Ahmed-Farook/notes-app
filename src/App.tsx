import React from 'react';
import { AuthProvider } from './store/AuthContext';
import { NotesProvider } from './store/NotesContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/Auth/AuthModal';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-[#FAF6EF] dark:bg-[#131B24] text-[#1C2B36] dark:text-[#E8EEF3]">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#1A2532] border border-[#DFD3C0] dark:border-[#2A3E52] shadow-xl text-center space-y-4">
            <h2 className="text-base font-bold">texō encountered an issue while loading</h2>
            <p className="text-xs text-[#5A6E82] dark:text-[#8AA0B4] leading-relaxed">
              {this.state.error?.message || 'A temporary issue occurred while rendering the interface.'}
            </p>
            <div className="flex justify-center space-x-2 pt-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-apple-yellow text-white rounded-xl text-xs font-semibold hover:bg-apple-yellowHover"
              >
                Reload App
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-[#1C2B36] dark:text-[#E8EEF3] rounded-xl text-xs font-semibold"
              >
                Reset &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotesProvider>
          <Layout />
          <AuthModal />
        </NotesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
