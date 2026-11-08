import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { RotateCcw, Trash2 } from 'lucide-react';

import { useNotes } from '../../store/NotesContext';
import { formatEditorDate } from '../../utils/dateUtils';
import { triggerHaptic } from '../../utils/haptics';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { EditorToolbar } from './EditorToolbar';

/**
 * CustomTaskItem: Toggles checkbox without opening virtual keyboard or stealing cursor focus
 * unless the editor was already focused (e.g. user already open with keyboard).
 */
const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li');
      const checkboxWrapper = document.createElement('label');
      const checkboxStyler = document.createElement('span');
      const checkbox = document.createElement('input');
      const content = document.createElement('div');

      const updateA11Y = () => {
        checkbox.ariaLabel =
          this.options.a11y?.checkboxLabel?.(node, checkbox.checked) ||
          `Task item checkbox for ${node.textContent || 'empty task item'}`;
      };

      updateA11Y();

      checkboxWrapper.contentEditable = 'false';
      checkbox.type = 'checkbox';
      checkbox.tabIndex = -1;

      // Stop propagation so clicking checkbox does not trigger outer container or editor focus listeners
      const stopBubbling = (event: Event) => {
        event.stopPropagation();
      };

      checkboxWrapper.addEventListener('click', stopBubbling);
      checkboxWrapper.addEventListener('touchstart', stopBubbling, { passive: true });
      checkboxWrapper.addEventListener('touchend', stopBubbling);
      checkboxWrapper.addEventListener('pointerdown', stopBubbling);

      // Prevent mousedown from causing contenteditable / input to steal cursor focus
      checkboxWrapper.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      checkbox.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      checkbox.addEventListener('click', stopBubbling);

      checkbox.addEventListener('change', (event) => {
        triggerHaptic();

        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked;
          return;
        }

        const { checked } = event.target as any;

        if (editor.isEditable && typeof getPos === 'function') {
          const isMobile =
            Capacitor.isNativePlatform() ||
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            ('ontouchstart' in window && window.innerWidth < 768);

          // Find the scroll container and capture current scroll position
          const scrollContainer = listItem.closest('.overflow-y-auto') as HTMLElement | null;
          const targetScrollTop = scrollContainer
            ? scrollContainer.scrollTop
            : (window.scrollY || document.documentElement.scrollTop);

          const wasFocused = editor.isFocused;
          let chain = editor.chain();

          // Only refocus on desktop platforms where this behavior is expected
          // NEVER refocus on mobile, so the viewport never scrolls away to an off-screen cursor
          if (!isMobile && wasFocused) {
            chain = chain.focus(undefined, { scrollIntoView: false });
          }

          chain
            .command(({ tr }) => {
              const position = getPos();
              if (typeof position !== 'number') {
                return false;
              }
              const currentNode = tr.doc.nodeAt(position);
              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
              });
              return true;
            })
            .run();

          if (isMobile) {
            // On mobile, blur the editor so no off-screen caret pulls the view back
            editor.commands.blur();

            if (
              document.activeElement &&
              (document.activeElement === checkbox ||
                document.activeElement.classList.contains('ProseMirror') ||
                document.activeElement.tagName === 'INPUT')
            ) {
              (document.activeElement as HTMLElement).blur();
            }

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              sel.removeAllRanges();
            }

            // Lock scroll position immediately and in animation frames to prevent any browser scroll jump
            if (scrollContainer) {
              scrollContainer.scrollTop = targetScrollTop;
              requestAnimationFrame(() => {
                scrollContainer.scrollTop = targetScrollTop;
              });
              setTimeout(() => {
                scrollContainer.scrollTop = targetScrollTop;
              }, 40);
            } else {
              window.scrollTo(0, targetScrollTop);
              requestAnimationFrame(() => {
                window.scrollTo(0, targetScrollTop);
              });
            }
          } else if (!wasFocused) {
            // Desktop when not previously focused
            if (
              document.activeElement &&
              (document.activeElement === checkbox ||
                document.activeElement.classList.contains('ProseMirror') ||
                document.activeElement.tagName === 'INPUT')
            ) {
              (document.activeElement as HTMLElement).blur();
            }
          }
        }

        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          if (!this.options.onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked;
          }
        }
      });

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      listItem.dataset.checked = String(node.attrs.checked);
      checkbox.checked = Boolean(node.attrs.checked);

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          listItem.dataset.checked = String(updatedNode.attrs.checked);
          checkbox.checked = Boolean(updatedNode.attrs.checked);
          updateA11Y();

          return true;
        },
      };
    };
  },
});

interface EditorProps {
  showToolbar: boolean;
  onRegisterToggleChecklist: (fn: () => void) => void;
}

export const Editor: React.FC<EditorProps> = ({ showToolbar, onRegisterToggleChecklist }) => {
  const {
    activeNote,
    createNote,
    updateNote,
    restoreNote,
    permanentlyDeleteNote,
  } = useNotes();

  const isUpdatingRef = useRef(false);
  const activeNoteRef = useRef(activeNote);
  activeNoteRef.current = activeNote;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      CustomTaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type something...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: activeNote ? activeNote.content : '',
    editable: Boolean(activeNote && !activeNote.isTrash),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[60vh] cursor-text select-text',
      },
    },
    onUpdate: ({ editor, transaction }) => {
      const currentNote = activeNoteRef.current;
      // Only process when document actually changed from user edits
      if (!currentNote || isUpdatingRef.current || !transaction.docChanged) return;

      const html = editor.getHTML();
      if (html === currentNote.content) return;

      const text = editor.getText();

      // Extract title and snippet preview from text
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines.length > 0 ? lines[0].substring(0, 80) : 'New Note';
      const plainTextPreview = lines.length > 1
        ? lines.slice(1).join(' ').substring(0, 150)
        : (lines.length === 1 && lines[0] !== title ? lines[0] : 'No additional text');

      updateNote(currentNote.id, {
        content: html,
        title,
        plainTextPreview,
      });
    },
  });

  // Register checklist toggle callback with parent
  useEffect(() => {
    if (editor) {
      onRegisterToggleChecklist(() => {
        editor.chain().focus().toggleTaskList().run();
      });
    }
  }, [editor, onRegisterToggleChecklist]);

  // Update editor content and editable state when active note changes
  useEffect(() => {
    if (!editor || !activeNote) return;

    editor.setEditable(!activeNote.isTrash);

    const currentHTML = editor.getHTML();
    if (currentHTML !== activeNote.content) {
      isUpdatingRef.current = true;
      editor.commands.setContent(activeNote.content, false);
      const timer = setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
      return () => {
        clearTimeout(timer);
        isUpdatingRef.current = false;
      };
    }
  }, [activeNote?.id, activeNote?.isTrash, editor]);

  // Dismiss cursor and blur editor when keyboard closes on mobile
  useEffect(() => {
    if (!editor) return;

    const isMobile =
      Capacitor.isNativePlatform() ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth < 768);

    if (!isMobile) return;

    const dismissCursorAndBlur = () => {
      // 1. Blur TipTap editor
      editor.commands.blur();

      // 2. Blur active DOM element
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // 3. Explicitly blur .ProseMirror element if present
      const proseMirrorEl = document.querySelector('.ProseMirror') as HTMLElement | null;
      if (proseMirrorEl) {
        proseMirrorEl.blur();
      }

      // 4. Clear any active DOM text selection range
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.removeAllRanges();
      }
    };

    // Native Capacitor Keyboard listeners for Android
    let willHideHandle: any = null;
    let didHideHandle: any = null;

    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillHide', dismissCursorAndBlur)
        .then((handle) => {
          willHideHandle = handle;
        })
        .catch(() => {});

      Keyboard.addListener('keyboardDidHide', dismissCursorAndBlur)
        .then((handle) => {
          didHideHandle = handle;
        })
        .catch(() => {});
    }

    // VisualViewport listener for mobile browsers & WebViews
    const initialHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    let isKeyboardOpen = false;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;
      const currentHeight = window.visualViewport.height;

      // If viewport shrank significantly, keyboard opened
      if (currentHeight < initialHeight - 140) {
        isKeyboardOpen = true;
      } else if (isKeyboardOpen && currentHeight >= initialHeight - 60) {
        // Keyboard just closed on mobile!
        isKeyboardOpen = false;
        dismissCursorAndBlur();
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (willHideHandle?.remove) willHideHandle.remove();
      if (didHideHandle?.remove) didHideHandle.remove();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, [editor]);

  if (!activeNote) {
    return (
      <div className="flex-1 bg-[#FAF6EF] dark:bg-[#131B24] flex flex-col items-center justify-center text-[#6E7E8E] dark:text-[#8AA0B4] select-none p-6 text-center">
        <p className="text-sm mb-3">Select a note or create a new one</p>
        <button
          onClick={() => createNote()}
          className="px-3 py-1.5 rounded-md bg-apple-yellow hover:bg-apple-yellowHover text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          Create Note
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#FAF6EF] dark:bg-[#131B24] flex flex-col h-full overflow-hidden relative select-text">
      {/* Optional Toolbar */}
      <EditorToolbar editor={editor} isVisible={showToolbar} />

      {/* Trash Warning Banner */}
      {activeNote.isTrash && (
        <div className="bg-[#EFE7D8] dark:bg-[#16202A] border-b border-[#DFD3C0] dark:border-[#223344] px-4 md:px-8 py-2.5 flex items-center justify-between text-xs transition-colors">
          <button
            onClick={() => {
              triggerHaptic();
              restoreNote(activeNote.id);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#DFD3C0] dark:border-[#2A3E52] bg-[#FAF6EF] dark:bg-[#1C2733] hover:bg-[#E5DCCB] dark:hover:bg-[#25394C] text-[#213A50] dark:text-[#7EAAD0] font-medium transition-all shadow-xs active:scale-95"
          >
            <RotateCcw size={14} className="stroke-[2.2]" />
            <span>Restore</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic();
              if (confirm('Permanently delete this note? This action cannot be undone.')) {
                permanentlyDeleteNote(activeNote.id);
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-500/10 dark:bg-red-950/40 hover:bg-red-500/20 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-medium transition-all shadow-xs active:scale-95"
          >
            <Trash2 size={14} className="stroke-[2.2]" />
            <span>Delete Permanently</span>
          </button>
        </div>
      )}

      {/* Editor Content Body (Scrollable container - date moves away on scroll) */}
      <div
        className="flex-1 overflow-y-auto px-5 md:px-14 py-3 pb-24 md:pb-8 cursor-text select-text"
        onClick={(e) => {
          if (editor && !activeNote.isTrash) {
            const target = e.target as HTMLElement;
            // Ignore if clicked on checkbox, label, select, or button
            if (
              target.closest('label') ||
              target.tagName === 'INPUT' ||
              target.closest('select') ||
              target.closest('button')
            ) {
              return;
            }
            // If clicked on empty space around or below the text, focus the editor at the end
            if (!target.closest('.ProseMirror')) {
              editor.commands.focus('end');
            }
          }
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Note Date Header: scrolls away with note content */}
          <div className="pt-2 pb-3 flex items-center justify-center text-[11px] text-neutral-400 dark:text-neutral-500 select-none">
            <span className="font-medium text-center">
              {formatEditorDate(activeNote.updatedAt)}
            </span>
          </div>

          <EditorContent
            editor={editor}
            className="prose prose-neutral dark:prose-invert focus:outline-none min-h-[60vh] select-text cursor-text"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              // If click was on a checkbox or its label, do NOT trigger focus or open keyboard
              if (
                target.tagName === 'INPUT' ||
                target.closest('label') ||
                target.closest('[data-type="taskItem"] > label')
              ) {
                return;
              }
              if (editor && !editor.isFocused && !activeNote.isTrash) {
                editor.commands.focus();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

