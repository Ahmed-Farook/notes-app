import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { RotateCcw, Trash2, Search, ChevronUp, ChevronDown, X, Plus, Edit3 } from 'lucide-react';

import { useNotes } from '../../store/NotesContext';
import { formatEditorDate } from '../../utils/dateUtils';
import { triggerHaptic } from '../../utils/haptics';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { EditorToolbar } from './EditorToolbar';
import { InNoteCanvas, DrawingToolType } from '../Drawing/InNoteCanvas';
import { MathBlock } from '../../extensions/MathExtension';

/**
 * CustomImage: Preserves drawing strokes JSON in data-strokes attribute for re-editing
 */
const CustomImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-strokes': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-strokes'),
        renderHTML: (attributes) => {
          if (!attributes['data-strokes']) return {};
          return { 'data-strokes': attributes['data-strokes'] };
        },
      },
    };
  },
});

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
      content.style.flex = '1 1 auto';
      content.style.minWidth = '1px';
      content.style.minHeight = '1.5rem';

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

/**
 * EnforceTitleExtension:
 * Enforces that the first line of every note is ALWAYS an h1 heading (the note title).
 * When backspace or delete is pressed in an empty title or at pos 0, it stays an h1 heading
 * instead of reverting to normal paragraph text.
 */
const EnforceTitleExtension = Extension.create({
  name: 'enforceTitle',

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        // If cursor/selection is within the first document node
        if ($from.index(0) === 0) {
          const firstNode = doc.firstChild;
          if (firstNode && firstNode.type.name === 'heading') {
            // If the heading is completely empty, prevent deleting block or turning to paragraph
            if (firstNode.textContent.length === 0) {
              return true;
            }
            // If cursor is at the very beginning of the heading and selection is collapsed
            if ($from.parentOffset === 0 && empty) {
              return true;
            }
          }
        }

        // When deleting at the start of a checklist item (taskItem), unwrap directly to start of line with 0 indentation
        const parentNode = $from.node(-1);
        if (parentNode && parentNode.type.name === 'taskItem') {
          if ($from.parentOffset === 0) {
            return editor.chain().focus().liftListItem('taskItem').clearNodes().run();
          }
        }

        // When pressing backspace on an empty textblock (like an empty paragraph after a checklist or table),
        // cleanly delete the empty paragraph and place cursor at the end of the previous block
        // instead of allowing ProseMirror joinBackward to convert it into a taskItem/checkbox!
        if (empty && $from.parent.isTextblock && $from.parent.content.size === 0 && $from.pos > 1) {
          const beforePos = $from.before();
          const tr = state.tr.delete(beforePos, $from.after());
          const targetPos = Math.max(1, beforePos - 1);
          tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
          editor.view.dispatch(tr);
          return true;
        }

        return false;
      },
      Delete: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from } = selection;

        if ($from.index(0) === 0) {
          const firstNode = doc.firstChild;
          if (firstNode && firstNode.type.name === 'heading' && firstNode.textContent.length === 0) {
            return true;
          }
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const { doc, tr, schema } = newState;
          const headingType = schema.nodes.heading;
          if (!headingType) return null;

          const firstNode = doc.firstChild;

          // If document is completely empty, insert an h1 heading
          if (!firstNode) {
            tr.insert(0, headingType.create({ level: 1 }));
            return tr;
          }

          // If first child is not an h1 heading, convert it to h1 heading
          if (firstNode.type.name !== 'heading' || firstNode.attrs.level !== 1) {
            tr.setNodeMarkup(0, headingType, { level: 1 });
            return tr;
          }

          // If the document ends with a table, image, or mathBlock, automatically append an empty paragraph after it
          // so the user always has a standard text caret and typing line below it!
          const last = doc.lastChild;
          if (last && (last.type.name === 'table' || last.type.name === 'image' || last.type.name === 'mathBlock')) {
            const paragraphType = schema.nodes.paragraph;
            if (paragraphType) {
              tr.insert(doc.content.size, paragraphType.create());
              return tr;
            }
          }

          return null;
        },
      }),
    ];
  },
});

const searchHighlightPluginKey = new PluginKey('searchHighlight');

const SearchHighlightExtension = Extension.create({
  name: 'searchHighlight',

  addStorage() {
    return {
      searchTerm: '',
      currentIndex: 0,
      matches: [] as { from: number; to: number }[],
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: searchHighlightPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldSet, oldState, newState) {
            const meta = tr.getMeta(searchHighlightPluginKey);
            if (meta) {
              if (typeof meta.searchTerm === 'string') {
                extension.storage.searchTerm = meta.searchTerm;
              }
              if (typeof meta.currentIndex === 'number') {
                extension.storage.currentIndex = meta.currentIndex;
              }
            }

            const term = (extension.storage.searchTerm || '').trim().toLowerCase();
            if (!term) {
              extension.storage.matches = [];
              return DecorationSet.empty;
            }

            const matches: { from: number; to: number }[] = [];
            newState.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const text = node.text.toLowerCase();
                let index = 0;
                while ((index = text.indexOf(term, index)) !== -1) {
                  matches.push({ from: pos + index, to: pos + index + term.length });
                  index += term.length;
                }
              }
            });

            extension.storage.matches = matches;
            const currentIndex = extension.storage.currentIndex || 0;

            const decorations = matches.map((m, i) => {
              const isActive = i === currentIndex;
              return Decoration.inline(m.from, m.to, {
                class: isActive ? 'search-match-active' : 'search-match',
              });
            });

            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
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
    searchQuery,
    setSearchQuery,
    theme,
  } = useNotes();

  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  // Samsung Notes Seamless In-Note Stylus Drawing State
  const [isPenMode, setIsPenMode] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>('pen');
  const [activeDrawingColor, setActiveDrawingColor] = useState(theme === 'dark' ? '#E8EEF3' : '#213A50');
  const [activeDrawingSize, setActiveDrawingSize] = useState(5);
  const [stylusOnly, setStylusOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem('texo_stylus_only') === 'true';
    } catch (_) {
      return false;
    }
  });
  const manualFingerOverrideRef = useRef(false);
  const [canDrawingUndo, setCanDrawingUndo] = useState(false);
  const [canDrawingRedo, setCanDrawingRedo] = useState(false);
  const [drawingUndoTrigger, setDrawingUndoTrigger] = useState(0);
  const [drawingRedoTrigger, setDrawingRedoTrigger] = useState(0);
  const [drawingClearTrigger, setDrawingClearTrigger] = useState(0);

  // Editor scroll container ref to reset scroll position on note change
  const editorScrollContainerRef = useRef<HTMLDivElement>(null);

  // Long-press / context menu state for Images, Tables and Math Formulas
  const [contextMenu, setContextMenu] = useState<{
    type: 'image' | 'table' | 'math';
    targetEl: HTMLElement;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Reset scroll position to top whenever switching notes
  useEffect(() => {
    if (editorScrollContainerRef.current) {
      editorScrollContainerRef.current.scrollTop = 0;
    }
  }, [activeNote?.id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || isPenMode) return;
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const img = target.closest('img') || (target.tagName === 'IMG' ? target : null);
    const table = target.closest('table');
    const math = target.closest('.katex-math-block') || target.closest('[data-type="math-block"]');
    if (!img && !table && !math) return;

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      triggerHaptic();
      setContextMenu({
        type: img ? 'image' : table ? 'table' : 'math',
        targetEl: (img || table || math) as HTMLElement,
      });
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isPenMode) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const img = target.closest('img') || (target.tagName === 'IMG' ? target : null);
    const table = target.closest('table');
    const math = target.closest('.katex-math-block') || target.closest('[data-type="math-block"]');
    if (img || table || math) {
      e.preventDefault();
      triggerHaptic();
      setContextMenu({
        type: img ? 'image' : table ? 'table' : 'math',
        targetEl: (img || table || math) as HTMLElement,
      });
    }
  };

  const handleToggleStylusOnly = () => {
    setStylusOnly((prev) => {
      const next = !prev;
      if (!next) {
        manualFingerOverrideRef.current = true;
      } else {
        manualFingerOverrideRef.current = false;
      }
      try {
        localStorage.setItem('texo_stylus_only', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleStylusDetected = () => {
    if (!stylusOnly && !manualFingerOverrideRef.current) {
      setStylusOnly(true);
      try {
        localStorage.setItem('texo_stylus_only', 'true');
      } catch (_) {}
    }
  };

  // Keep drawing color contrasting with theme changes if user hasn't customized it
  useEffect(() => {
    if (theme === 'dark' && activeDrawingColor === '#213A50') {
      setActiveDrawingColor('#E8EEF3');
    } else if (theme === 'light' && activeDrawingColor === '#E8EEF3') {
      setActiveDrawingColor('#213A50');
    }
  }, [theme]);

  // Compute container min-height so strokes never get clipped and space dynamically expands
  const containerMinHeight = useMemo(() => {
    let maxY = 0;
    if (activeNote?.drawingStrokes) {
      try {
        const parsed = JSON.parse(activeNote.drawingStrokes);
        if (Array.isArray(parsed)) {
          for (const stroke of parsed) {
            for (const pt of stroke.points) {
              if (pt.y > maxY) maxY = pt.y;
            }
          }
        }
      } catch (_) {}
    }
    return maxY > 0 ? Math.ceil(maxY + 60) : 0;
  }, [activeNote?.drawingStrokes]);

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
      EnforceTitleExtension,
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      CustomTaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      MathBlock,
      Placeholder.configure({
        placeholder: ({ pos }) => {
          if (pos === 0) {
            return 'Title';
          }
          return '';
        },
        emptyNodeClass: 'is-empty-node',
        emptyEditorClass: 'is-editor-empty',
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'note-drawing-image',
        },
      }),
      SearchHighlightExtension,
    ],
    content: activeNote ? activeNote.content : '',
    editable: Boolean(activeNote && !activeNote.isTrash),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[140px] cursor-text select-text',
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
      let title = lines.length > 0 ? lines[0].substring(0, 80) : 'New Note';
      let plainTextPreview = lines.length > 1
        ? lines.slice(1).join(' ').substring(0, 150)
        : (lines.length === 1 && lines[0] !== title ? lines[0] : 'No additional text');

      // If note has a drawing but no text lines
      if (lines.length === 0 && html.includes('<img')) {
        title = 'Drawing Note';
        plainTextPreview = '[Handwritten Drawing / Annotation]';
      }

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

  // Reset scroll position to top whenever switching notes so the new note starts cleanly from the top
  useEffect(() => {
    if (editorScrollContainerRef.current) {
      editorScrollContainerRef.current.scrollTop = 0;
    }
  }, [activeNote?.id]);

  // Update editor content and editable state when active note changes or remote sync arrives
  useEffect(() => {
    if (!editor || !activeNote) return;

    editor.setEditable(!activeNote.isTrash);

    let contentToLoad = activeNote.content || '<p></p>';
    // Migrate legacy notes where title was saved as <h3> to <h1>
    if (/^\s*<h3>([\s\S]*?)<\/h3>/i.test(contentToLoad)) {
      contentToLoad = contentToLoad.replace(/^\s*<h3>([\s\S]*?)<\/h3>/i, '<h1>$1</h1>');
      updateNote(activeNote.id, { content: contentToLoad });
    }

    const currentHTML = editor.getHTML();
    if (currentHTML !== contentToLoad) {
      isUpdatingRef.current = true;

      // Preserve cursor selection if editor is focused on this device
      const isFocused = editor.isFocused;
      const { from, to } = editor.state.selection;

      editor.commands.setContent(contentToLoad, false);

      if (isFocused) {
        try {
          const maxPos = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.min(from, maxPos),
            to: Math.min(to, maxPos),
          });
        } catch (_) {}
      }

      const timer = setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
      return () => {
        clearTimeout(timer);
        isUpdatingRef.current = false;
      };
    }
  }, [activeNote?.id, activeNote?.content, activeNote?.isTrash, editor]);

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

  // Synchronize in-note search highlight with active note and search query
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const term = searchQuery.trim();

    const { tr } = editor.state;
    tr.setMeta(searchHighlightPluginKey, { searchTerm: term, currentIndex: 0 });
    editor.view.dispatch(tr);

    const matches = (editor.storage as any).searchHighlight?.matches || [];
    setTotalMatches(matches.length);
    setCurrentMatchIndex(0);

    if (matches.length > 0) {
      requestAnimationFrame(() => {
        const el = document.querySelector('.search-match-active');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [searchQuery, editor, activeNote?.id, activeNote?.content]);

  const goToMatch = (newIndex: number) => {
    if (!editor || totalMatches === 0) return;
    const boundedIndex = (newIndex + totalMatches) % totalMatches;
    setCurrentMatchIndex(boundedIndex);

    const { tr } = editor.state;
    tr.setMeta(searchHighlightPluginKey, { currentIndex: boundedIndex });
    editor.view.dispatch(tr);

    requestAnimationFrame(() => {
      const el = document.querySelector('.search-match-active');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleNextMatch = () => {
    goToMatch(currentMatchIndex + 1);
  };

  const handlePrevMatch = () => {
    goToMatch(currentMatchIndex - 1);
  };

  // Keyboard navigation for search (Enter for next, Shift+Enter for previous, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!searchQuery) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevMatch();
        } else {
          handleNextMatch();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, totalMatches, currentMatchIndex]);

  // Focuses or creates a clean typing line below existing content (picture, table, text, checklist)
  const handleFocusOrCreateLineBelow = useCallback(() => {
    if (!editor || activeNote?.isTrash || isPenMode) return;

    const { state, view } = editor;
    const { doc, schema, tr } = state;
    const paragraphType = schema.nodes.paragraph;
    if (!paragraphType) return;

    const lastChild = doc.lastChild;

    // If the last child is already an empty paragraph, focus it directly
    if (lastChild && lastChild.type.name === 'paragraph' && lastChild.content.size === 0) {
      editor.chain().focus('end').run();
      return;
    }

    // If the document ends with content (text, table, image, math, checklist),
    // append an empty paragraph 1-2 lines below and place the cursor there!
    const endPos = doc.content.size;
    const newTr = tr.insert(endPos, paragraphType.create());
    view.dispatch(newTr);
    editor.chain().focus('end').run();
  }, [editor, activeNote?.isTrash, isPenMode]);

  if (!activeNote) {
    return (
      <div className="flex-1 apple-paper-bg flex flex-col items-center justify-center text-[#6E7E8E] dark:text-[#8AA0B4] select-none p-6 text-center">
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
    <div className="flex-1 apple-paper-bg flex flex-col h-full overflow-hidden relative select-text animate-editor-enter">
      {/* Samsung Notes Toolbar */}
      <EditorToolbar
        editor={editor}
        isVisible={showToolbar}
        isPenMode={isPenMode}
        onTogglePenMode={(mode) => {
          setIsPenMode(mode);
          if (mode && editor) {
            editor.commands.blur();
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
          }
        }}
        activeDrawingTool={activeDrawingTool}
        onChangeDrawingTool={setActiveDrawingTool}
        activeColor={activeDrawingColor}
        onChangeColor={setActiveDrawingColor}
        activeSize={activeDrawingSize}
        onChangeSize={setActiveDrawingSize}
        stylusOnly={stylusOnly}
        onToggleStylusOnly={handleToggleStylusOnly}
        canDrawingUndo={canDrawingUndo}
        canDrawingRedo={canDrawingRedo}
        onDrawingUndo={() => setDrawingUndoTrigger((c) => c + 1)}
        onDrawingRedo={() => setDrawingRedoTrigger((c) => c + 1)}
        onDrawingClear={() => setDrawingClearTrigger((c) => c + 1)}
      />

      {/* In-Note Search & Highlight Bar */}
      {searchQuery && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-apple-border dark:border-apple-borderDark bg-[#EFE7D8]/95 dark:bg-[#151E28]/95 backdrop-blur-md z-30 text-xs shrink-0 select-none shadow-xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Search size={14} className="text-[#395060] dark:text-[#7EAAD0] shrink-0" />
            <span className="font-semibold text-[#1C2B36] dark:text-[#E8EEF3] truncate max-w-[130px] sm:max-w-[200px]">
              "{searchQuery}"
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#E5DCCB] dark:bg-[#203244] text-[#5A6D7E] dark:text-[#8AA0B4] shrink-0">
              {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : '0 results'}
            </span>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={handlePrevMatch}
              disabled={totalMatches === 0}
              title="Previous match (Shift+Enter)"
              className="p-1 rounded hover:bg-[#E5DCCB] dark:hover:bg-[#203244] text-[#1C2B36] dark:text-[#E8EEF3] disabled:opacity-30 disabled:hover:bg-transparent transition-colors active:scale-95"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={totalMatches === 0}
              title="Next match (Enter)"
              className="p-1 rounded hover:bg-[#E5DCCB] dark:hover:bg-[#203244] text-[#1C2B36] dark:text-[#E8EEF3] disabled:opacity-30 disabled:hover:bg-transparent transition-colors active:scale-95"
            >
              <ChevronDown size={16} />
            </button>
            <div className="h-3.5 w-px bg-[#DFD3C0] dark:bg-[#243547] mx-1" />
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              title="Close search (Esc)"
              className="p-1 rounded hover:bg-[#E5DCCB] dark:hover:bg-[#203244] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors active:scale-95"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Trash Warning Banner */}
      {activeNote.isTrash && (
        <div className="bg-[#EFE7D8] dark:bg-[#16202A] border-b border-[#DFD3C0] dark:border-[#223344] px-4 md:px-8 py-2.5 flex items-center justify-between text-xs transition-colors">
          <button
            onClick={() => {
              restoreNote(activeNote.id);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#DFD3C0] dark:border-[#2A3E52] bg-[#FAF6EF] dark:bg-[#1C2733] hover:bg-[#E5DCCB] dark:hover:bg-[#25394C] text-[#213A50] dark:text-[#7EAAD0] font-medium transition-all shadow-xs active:scale-95"
          >
            <RotateCcw size={14} className="stroke-[2.2]" />
            <span>Restore</span>
          </button>
          <div className="hidden sm:flex items-center text-[11px] text-[#6E7E8E] dark:text-[#8AA0B4]">
            {(() => {
              const elapsed = Date.now() - (activeNote.deletedAt ?? activeNote.updatedAt);
              const daysLeft = Math.max(0, Math.ceil((7 * 24 * 60 * 60 * 1000 - elapsed) / (24 * 60 * 60 * 1000)));
              return daysLeft === 0 ? 'Deleting soon' : `${daysLeft}d left in Recently Deleted`;
            })()}
          </div>
          <button
            onClick={() => {
              permanentlyDeleteNote(activeNote.id);
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
        ref={editorScrollContainerRef}
        className="flex-1 overflow-y-auto px-5 md:px-14 py-3 pb-24 md:pb-8 cursor-text select-text"
        onClick={(e) => {
          if (editor && !activeNote.isTrash && !isPenMode) {
            const target = e.target as HTMLElement;
            // Ignore if clicked on checkbox, label, select, or button
            if (
              target.closest('label') ||
              target.tagName === 'INPUT' ||
              target.closest('select') ||
              target.closest('button') ||
              target.closest('.tiptap-table-controls') ||
              target.closest('.katex-math-block')
            ) {
              return;
            }
            // If clicked on empty space around or below the text, bring cursor up 1-2 lines below content
            if (!target.closest('.ProseMirror')) {
              handleFocusOrCreateLineBelow();
            }
          }
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Note Date Header: scrolls away with note content */}
          <div className="pt-2 pb-3 flex items-center justify-center text-[11px] text-[#6E8092] dark:text-[#8AA0B4] select-none">
            <span className="font-semibold text-center">
              {formatEditorDate(activeNote.updatedAt)}
            </span>
          </div>

          <div className="relative" style={{ minHeight: containerMinHeight > 0 ? `${containerMinHeight}px` : undefined }}>
            <EditorContent
              editor={editor}
              className="prose prose-neutral dark:prose-invert focus:outline-none min-h-[140px] select-text cursor-text"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={handleContextMenu}
              onClick={(e) => {
                if (isPenMode) return;
                const target = e.target as HTMLElement;
                // If click was on a checkbox or its label, do NOT trigger focus or open keyboard
                if (
                  target.tagName === 'INPUT' ||
                  target.closest('label') ||
                  target.closest('[data-type="taskItem"] > label') ||
                  target.closest('.tiptap-table-controls') ||
                  target.closest('.katex-math-block')
                ) {
                  return;
                }
                const proseMirror = target.closest('.ProseMirror') as HTMLElement | null;
                if (proseMirror && e.clientY > proseMirror.getBoundingClientRect().bottom - 40) {
                  handleFocusOrCreateLineBelow();
                } else if (editor && !editor.isFocused && !activeNote.isTrash) {
                  editor.commands.focus();
                }
              }}
            />

            {/* 5 lines of visual padding (~112px) where clicking brings the cursor up to the line below, and typing preserves this buffer underneath */}
            <div
              className="h-28 w-full cursor-text select-none"
              onClick={handleFocusOrCreateLineBelow}
              aria-hidden="true"
            />

            {/* Seamless In-Note Drawing Canvas Overlay */}
            <InNoteCanvas
              noteId={activeNote.id}
              theme={theme}
              initialStrokesJson={activeNote.drawingStrokes}
              isPenMode={isPenMode}
              activeTool={activeDrawingTool}
              activeColor={activeDrawingColor}
              activeSize={activeDrawingSize}
              stylusOnly={stylusOnly}
              onStylusDetected={handleStylusDetected}
              onStrokesUpdate={(strokesJson) => {
                const currentNote = activeNoteRef.current;
                if (!currentNote) return;

                const updates: any = {
                  drawingStrokes: strokesJson,
                };

                // If note has no custom title or is 'New Note', and user drew something
                if ((!currentNote.title || currentNote.title === 'New Note') && strokesJson !== '[]') {
                  updates.title = 'Handwritten Note';
                  updates.plainTextPreview = '[Handwritten Drawing / Annotation]';
                }

                updateNote(currentNote.id, updates);
              }}
              onHistoryChange={(canUndo, canRedo) => {
                setCanDrawingUndo(canUndo);
                setCanDrawingRedo(canRedo);
              }}
              undoTrigger={drawingUndoTrigger}
              redoTrigger={drawingRedoTrigger}
              clearTrigger={drawingClearTrigger}
            />
          </div>
        </div>
      </div>

      {/* Long-Press / Right-Click Floating Action Modal for Images, Tables and Math Formulas */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px] animate-in fade-in duration-150"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="bg-[#FAF6EF] dark:bg-[#1C2733] border border-[#DFD3C0] dark:border-[#263747] rounded-xl shadow-2xl p-2.5 min-w-[210px] max-w-[280px] text-xs animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 font-semibold text-[#5A6E82] dark:text-[#8AA0B4] uppercase tracking-wider text-[10px]">
              {contextMenu.type === 'image'
                ? 'Image Options'
                : contextMenu.type === 'table'
                ? 'Table Options'
                : 'Formula Options'}
            </div>

            {contextMenu.type === 'image' ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  if (editor && contextMenu.targetEl) {
                    try {
                      const pos = editor.view.posAtDOM(contextMenu.targetEl, 0);
                      if (typeof pos === 'number' && pos >= 0) {
                        editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
                      } else {
                        contextMenu.targetEl.remove();
                      }
                    } catch (_) {
                      contextMenu.targetEl.remove();
                    }
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete Image</span>
              </button>
            ) : contextMenu.type === 'table' ? (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    editor?.chain().focus().deleteTable().run();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    editor?.chain().focus().addRowAfter().run();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-[#213A50] dark:text-[#E8EEF3] hover:bg-[#EBE2D3] dark:hover:bg-[#263747] transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Row Below</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    editor?.chain().focus().addColumnAfter().run();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-[#213A50] dark:text-[#E8EEF3] hover:bg-[#EBE2D3] dark:hover:bg-[#263747] transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Column Right</span>
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    if (editor && contextMenu.targetEl) {
                      let deleted = false;
                      try {
                        const target = contextMenu.targetEl;
                        editor.state.doc.descendants((node, pos) => {
                          if (deleted) return false;
                          if (node.type.name === 'mathBlock') {
                            const dom = editor.view.nodeDOM(pos);
                            if (
                              dom === target ||
                              (dom && (dom as HTMLElement).contains(target)) ||
                              target.contains(dom as Node)
                            ) {
                              editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
                              deleted = true;
                              return false;
                            }
                          }
                          return true;
                        });
                      } catch (_) {}

                      if (!deleted) {
                        try {
                          const pos = editor.view.posAtDOM(contextMenu.targetEl, 0);
                          if (typeof pos === 'number' && pos >= 0) {
                            const node = editor.state.doc.nodeAt(pos);
                            const size = node ? node.nodeSize : 1;
                            editor.chain().focus().deleteRange({ from: pos, to: pos + size }).run();
                            deleted = true;
                          }
                        } catch (_) {}
                      }

                      if (!deleted) {
                        contextMenu.targetEl.remove();
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete Formula</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    if (contextMenu.targetEl) {
                      contextMenu.targetEl.click();
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-[#213A50] dark:text-[#E8EEF3] hover:bg-[#EBE2D3] dark:hover:bg-[#263747] transition-colors"
                >
                  <Edit3 size={14} />
                  <span>Edit Formula</span>
                </button>
              </div>
            )}

            <div className="h-px bg-[#DFD3C0] dark:bg-[#263747] my-1.5" />
            <button
              type="button"
              onClick={() => setContextMenu(null)}
              className="w-full text-center px-3 py-1.5 rounded-lg text-[#6E8092] dark:text-[#8AA0B4] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

