import React, { useState, useRef, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TopNavbar } from './Header/TopNavbar';
import { FolderList } from './Sidebar/FolderList';
import { NotesList } from './NotesList/NotesList';
import { Editor } from './Editor/Editor';
import { useNotes } from '../store/NotesContext';
import { useAuth } from '../store/AuthContext';
import { Plus } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { useAppUpdater } from '../hooks/useAppUpdater';
import { UpdateBanner } from './Updates/UpdateBanner';
import { UpdateModal } from './Updates/UpdateModal';

export const Layout: React.FC = () => {
  const {
    isSidebarOpen,
    createNote,
    mobileView,
    setMobileView,
    isFolderPickerOpen,
    setIsFolderPickerOpen,
    searchQuery,
    setSearchQuery,
    selectedFolderId,
    setSelectedFolderId,
  } = useNotes();
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [showFormatToolbar, setShowFormatToolbar] = useState(true);
  const checklistActionRef = useRef<(() => void) | null>(null);
  const updater = useAppUpdater();

  // State refs for hardware back button handler
  const mobileViewRef = useRef(mobileView);
  mobileViewRef.current = mobileView;

  const isFolderPickerOpenRef = useRef(isFolderPickerOpen);
  isFolderPickerOpenRef.current = isFolderPickerOpen;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const selectedFolderIdRef = useRef(selectedFolderId);
  selectedFolderIdRef.current = selectedFolderId;

  const isAuthModalOpenRef = useRef(isAuthModalOpen);
  isAuthModalOpenRef.current = isAuthModalOpen;

  const isUpdaterModalOpenRef = useRef(updater.isModalOpen);
  isUpdaterModalOpenRef.current = updater.isModalOpen;

  // Android Hardware Back Button navigation
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any = null;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener('backButton', () => {
        // 1. Close updater modal if open
        if (isUpdaterModalOpenRef.current) {
          updater.closeModal();
          return;
        }

        // 2. Close auth modal if open
        if (isAuthModalOpenRef.current) {
          closeAuthModal();
          return;
        }

        // 3. Close mobile folder bottom sheet if open
        if (isFolderPickerOpenRef.current) {
          setIsFolderPickerOpen(false);
          return;
        }

        // 4. If inside a note on mobile, navigate back to notes list
        if (mobileViewRef.current === 'editor') {
          setMobileView('list');
          return;
        }

        // 5. If search query is active, clear it
        if (searchQueryRef.current && searchQueryRef.current.trim().length > 0) {
          setSearchQuery('');
          return;
        }

        // 6. If in custom folder or trash, navigate back to main Notes section
        if (selectedFolderIdRef.current !== 'default') {
          setSelectedFolderId('default');
          return;
        }

        // 7. If at root notes page with no modals open, exit app
        CapApp.exitApp();
      });
    };

    setupListener();

    return () => {
      if (listenerHandle?.remove) {
        listenerHandle.remove();
      }
    };
  }, [updater, closeAuthModal, setIsFolderPickerOpen, setMobileView, setSearchQuery, setSelectedFolderId]);

  // Global Keyboard Shortcuts (Cmd/Ctrl + N for new note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNote]);

  const handleToggleChecklist = () => {
    if (checklistActionRef.current) {
      checklistActionRef.current();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f6f6] dark:bg-[#1e1e1e] font-sans pb-[env(safe-area-inset-bottom)] select-none">
      {/* Top Navbar */}
      <TopNavbar
        onToggleChecklist={handleToggleChecklist}
        onFormatClick={() => setShowFormatToolbar(prev => !prev)}
        onCheckUpdates={updater.openModal}
        hasUpdate={Boolean(updater.updateInfo?.hasUpdate)}
      />

      {/* Software Update Notification Banner */}
      {updater.isBannerVisible && updater.updateInfo && (
        <UpdateBanner
          updateInfo={updater.updateInfo}
          onOpenDetails={updater.openModal}
          onDismiss={updater.dismissBanner}
        />
      )}

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop 3-Pane Layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {/* Pane 1: Folders / Tags Sidebar */}
          {isSidebarOpen && (
            <FolderList
              onCheckUpdates={updater.openModal}
              hasUpdate={Boolean(updater.updateInfo?.hasUpdate)}
            />
          )}

          {/* Pane 2: Notes List & Search */}
          <NotesList />

          {/* Pane 3: Rich Text Editor */}
          <Editor
            showToolbar={showFormatToolbar}
            onRegisterToggleChecklist={(fn) => {
              checklistActionRef.current = fn;
            }}
          />
        </div>

        {/* Mobile / Android Responsive Layout */}
        <div className="flex md:hidden flex-1 overflow-hidden relative">
          {mobileView === 'list' ? (
            <div className="w-full h-full flex flex-col relative">
              <NotesList />
              {/* Android Floating Action Button (FAB) */}
              <button
                onClick={() => {
                  triggerHaptic();
                  createNote();
                }}
                className="absolute right-5 bottom-6 w-14 h-14 rounded-full bg-apple-yellow text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30"
                title="New Note"
              >
                <Plus size={28} />
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <Editor
                showToolbar={showFormatToolbar}
                onRegisterToggleChecklist={(fn) => {
                  checklistActionRef.current = fn;
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Software Update Modal */}
      <UpdateModal
        isOpen={updater.isModalOpen}
        onClose={updater.closeModal}
        updateInfo={updater.updateInfo}
        isChecking={updater.isChecking}
        error={updater.error}
        onCheckAgain={updater.checkAgain}
      />
    </div>
  );
};
