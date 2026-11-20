import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../../types/note';
import { triggerHaptic } from '../../utils/haptics';
import { syncNoteToAndroidWidget } from '../../utils/widgetSync';
import { useNotes } from '../../store/NotesContext';
import { Check, ChevronDown, X } from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
}

interface ChecklistEditorProps {
  note: Note;
  onUpdate: (updates: Partial<Note>) => void;
  isReadOnly?: boolean;
  theme?: 'light' | 'dark';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseChecklistHtml(html: string, fallbackTitle: string): {
  title: string;
  activeTasks: ChecklistItem[];
  completedTasks: ChecklistItem[];
} {
  let title = fallbackTitle || 'To-Do List';
  const activeTasks: ChecklistItem[] = [];
  const completedTasks: ChecklistItem[] = [];

  if (!html) {
    return { title, activeTasks, completedTasks };
  }

  try {
    if (typeof document !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h1 = doc.querySelector('h1');
      if (h1 && h1.textContent?.trim()) {
        title = h1.textContent.trim();
      }

      const taskNodes = doc.querySelectorAll('li[data-type="taskItem"]');
      taskNodes.forEach((node, idx) => {
        const isChecked =
          node.getAttribute('data-checked') === 'true' ||
          Boolean(node.querySelector('input[type="checkbox"]:checked'));

        const clone = node.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, label').forEach((el) => el.remove());
        const text = clone.textContent?.trim() || '';

        if (text) {
          const item: ChecklistItem = {
            id: `task-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            text,
          };
          if (isChecked) {
            completedTasks.push(item);
          } else {
            activeTasks.push(item);
          }
        }
      });

      return { title, activeTasks, completedTasks };
    }
  } catch (_) {}

  // Fallback regex parsing
  const titleMatch = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  const taskRegex =
    /<li[^>]*data-type=["']taskItem["'][^>]*data-checked=["'](true|false)["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = taskRegex.exec(html)) !== null) {
    const isChecked = match[1].toLowerCase() === 'true';
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text) {
      const item: ChecklistItem = {
        id: `task-${idx++}-${Math.random().toString(36).slice(2, 6)}`,
        text,
      };
      if (isChecked) {
        completedTasks.push(item);
      } else {
        activeTasks.push(item);
      }
    }
  }

  return { title, activeTasks, completedTasks };
}

function serializeChecklistHtml(
  title: string,
  active: ChecklistItem[],
  completed: ChecklistItem[]
): string {
  const safeTitle = escapeHtml(title.trim() || 'To-Do List');
  const activeLis = active
    .filter((t) => t.text.trim().length > 0)
    .map(
      (t) =>
        `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${escapeHtml(
          t.text
        )}</p></div></li>`
    )
    .join('');

  const completedLis = completed
    .filter((t) => t.text.trim().length > 0)
    .map(
      (t) =>
        `<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>${escapeHtml(
          t.text
        )}</p></div></li>`
    )
    .join('');

  const lis =
    activeLis + completedLis ||
    '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>';

  return `<h1>${safeTitle}</h1><ul data-type="taskList">${lis}</ul>`;
}

export const ChecklistEditor: React.FC<ChecklistEditorProps> = ({
  note,
  onUpdate,
  isReadOnly = false,
}) => {
  const { notes } = useNotes();
  const [title, setTitle] = useState(note.title || 'To-Do List');
  const [activeTasks, setActiveTasks] = useState<ChecklistItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<ChecklistItem[]>([]);
  const [adderText, setAdderText] = useState('');
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(false);

  const adderInputRef = useRef<HTMLInputElement>(null);
  const taskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const lastSavedHtmlRef = useRef<string>('');
  const currentNoteIdRef = useRef<string>(note.id);

  // Sync internal state when active note changes or external updates arrive
  useEffect(() => {
    const isNewNote = currentNoteIdRef.current !== note.id;
    currentNoteIdRef.current = note.id;

    if (isNewNote || note.content !== lastSavedHtmlRef.current) {
      const parsed = parseChecklistHtml(note.content, note.title);
      setTitle(parsed.title);
      setActiveTasks(parsed.activeTasks);
      setCompletedTasks(parsed.completedTasks);
      lastSavedHtmlRef.current = note.content;

      // Focus adder input for newly opened / created empty checklist
      if (isNewNote && !isReadOnly && parsed.activeTasks.length === 0) {
        setTimeout(() => {
          adderInputRef.current?.focus();
        }, 80);
      }
    }
  }, [note.id, note.content, note.title, isReadOnly]);

  // Persist and synchronize to storage and Android home screen widget
  const commitChanges = useCallback(
    (newTitle: string, newActive: ChecklistItem[], newCompleted: ChecklistItem[]) => {
      const serialized = serializeChecklistHtml(newTitle, newActive, newCompleted);
      lastSavedHtmlRef.current = serialized;

      const total = newActive.length + newCompleted.length;
      const plainTextPreview =
        total > 0
          ? `${newCompleted.length}/${total} completed`
          : '0 tasks completed';

      const cleanTitle = newTitle.trim() || 'To-Do List';

      onUpdate({
        title: cleanTitle,
        content: serialized,
        plainTextPreview,
      });

      // Synchronize with Android home screen widget
      if (notes && notes.length > 0) {
        const updatedNotes = notes.map((n) =>
          n.id === note.id
            ? { ...n, title: cleanTitle, content: serialized, plainTextPreview }
            : n
        );
        syncNoteToAndroidWidget(updatedNotes, note.id);
      }
    },
    [note.id, notes, onUpdate]
  );

  // Title change handler
  const handleTitleChange = (val: string) => {
    setTitle(val);
    commitChanges(val, activeTasks, completedTasks);
  };

  // First line adder key down handler
  const handleAdderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = adderText.trim();
      if (!text) return;

      const newTask: ChecklistItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
      };

      const nextActive = [...activeTasks, newTask];
      setActiveTasks(nextActive);
      setAdderText('');
      triggerHaptic();
      commitChanges(title, nextActive, completedTasks);
    }
  };

  // Active task text change
  const handleTaskTextChange = (id: string, text: string) => {
    const nextActive = activeTasks.map((t) => (t.id === id ? { ...t, text } : t));
    setActiveTasks(nextActive);
    commitChanges(title, nextActive, completedTasks);
  };

  // Active task keyboard navigation / deletion
  const handleActiveTaskKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    taskId: string
  ) => {
    if (e.key === 'Backspace' && activeTasks[index]?.text === '') {
      e.preventDefault();
      handleDeleteActiveTask(taskId);
      if (index > 0) {
        const prevTask = activeTasks[index - 1];
        taskInputRefs.current.get(prevTask.id)?.focus();
      } else {
        adderInputRef.current?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (index < activeTasks.length - 1) {
        const nextTask = activeTasks[index + 1];
        taskInputRefs.current.get(nextTask.id)?.focus();
      } else {
        adderInputRef.current?.focus();
      }
    }
  };

  // Complete an active task: moves to Completed section
  const handleCompleteTask = (taskId: string) => {
    const task = activeTasks.find((t) => t.id === taskId);
    if (!task) return;
    triggerHaptic();

    const nextActive = activeTasks.filter((t) => t.id !== taskId);
    const nextCompleted = [task, ...completedTasks];

    setActiveTasks(nextActive);
    setCompletedTasks(nextCompleted);
    commitChanges(title, nextActive, nextCompleted);
  };

  // Untick a completed task: moves back to Active tasks
  const handleUntickTask = (taskId: string) => {
    const task = completedTasks.find((t) => t.id === taskId);
    if (!task) return;
    triggerHaptic();

    const nextCompleted = completedTasks.filter((t) => t.id !== taskId);
    const nextActive = [...activeTasks, task];

    setCompletedTasks(nextCompleted);
    setActiveTasks(nextActive);
    commitChanges(title, nextActive, nextCompleted);
  };

  // Delete active task
  const handleDeleteActiveTask = (taskId: string) => {
    const nextActive = activeTasks.filter((t) => t.id !== taskId);
    setActiveTasks(nextActive);
    commitChanges(title, nextActive, completedTasks);
  };

  // Delete completed task
  const handleDeleteCompletedTask = (taskId: string) => {
    const nextCompleted = completedTasks.filter((t) => t.id !== taskId);
    setCompletedTasks(nextCompleted);
    commitChanges(title, activeTasks, nextCompleted);
  };

  // Clear all completed tasks
  const handleClearAllCompleted = () => {
    triggerHaptic();
    setCompletedTasks([]);
    commitChanges(title, activeTasks, []);
  };

  return (
    <div
      className="tiptap prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[140px] pb-32 select-text"
      data-pdf-note-id={note.id}
    >
      {/* Checklist Title Heading with generous 1-line breathing room (2.75rem / 44px) matching standard notes */}
      <h1 className="mb-11" style={{ marginBottom: '2.75rem' }}>
        <input
          type="text"
          value={title}
          disabled={isReadOnly}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adderInputRef.current?.focus();
            }
          }}
          placeholder="To-Do List"
          className="w-full bg-transparent border-none outline-none font-bold text-[2rem] sm:text-[2.25rem] text-[#1C2B36] dark:text-[#E8EEF3] tracking-tight placeholder:text-[#8AA0B4]/40 leading-[2.5rem]"
          aria-label="Checklist Title"
        />
      </h1>

      {/* Line 1: Quick List Adder (Type task here and press Enter to add) */}
      {!isReadOnly && (
        <div className="flex items-center gap-3 py-1.5 px-0.5 group">
          <div className="w-[1.15rem] h-[1.15rem] rounded-full border-[1.5px] border-[#c2b5a1] dark:border-[#3b5062] flex-shrink-0 grid place-content-center opacity-60" />
          <input
            ref={adderInputRef}
            type="text"
            value={adderText}
            onChange={(e) => setAdderText(e.target.value)}
            onKeyDown={handleAdderKeyDown}
            placeholder="Type a task and press Enter..."
            className="flex-1 bg-transparent border-none outline-none text-[15px] sm:text-base text-[#213A50] dark:text-[#E8EEF3] placeholder:text-[#8AA0B4]/60 dark:placeholder:text-[#52667A]/60 leading-relaxed"
            aria-label="Add task"
          />
        </div>
      )}

      {/* Active Tasks List */}
      <div className="space-y-1 mt-1">
        {activeTasks.map((task, index) => (
          <div
            key={task.id}
            className="group flex items-start gap-3 py-1 px-0.5 rounded-lg transition-colors"
          >
            {/* Interactive Checkbox */}
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => handleCompleteTask(task.id)}
              className="w-[1.15rem] h-[1.15rem] mt-0.5 rounded-full border-[1.5px] border-[#c2b5a1] dark:border-[#3b5062] hover:border-[#213A50] dark:hover:border-[#4B708B] flex-shrink-0 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Mark task as completed"
            />

            {/* Editable Task Text */}
            <input
              ref={(el) => {
                if (el) taskInputRefs.current.set(task.id, el);
                else taskInputRefs.current.delete(task.id);
              }}
              type="text"
              disabled={isReadOnly}
              value={task.text}
              onChange={(e) => handleTaskTextChange(task.id, e.target.value)}
              onKeyDown={(e) => handleActiveTaskKeyDown(e, index, task.id)}
              className="flex-1 bg-transparent border-none outline-none text-[15px] sm:text-base text-[#213A50] dark:text-[#E8EEF3] leading-relaxed"
            />

            {/* Delete button (hover on desktop or touch) */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleDeleteActiveTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#8AA0B4] hover:text-red-500 rounded flex-shrink-0 cursor-pointer"
                aria-label="Delete task"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Dedicated Completed Section at Bottom */}
      {completedTasks.length > 0 && (
        <div className="mt-8 pt-4 border-t border-[#DFD7CC]/60 dark:border-[#223344]/80">
          <div className="flex items-center justify-between mb-3 select-none">
            <button
              type="button"
              onClick={() => setIsCompletedCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#6E8092] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-[#E8EEF3] transition-colors cursor-pointer"
              aria-expanded={!isCompletedCollapsed}
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isCompletedCollapsed ? '-rotate-90' : ''
                }`}
              />
              <span>Completed ({completedTasks.length})</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleClearAllCompleted}
                className="text-[11px] font-medium text-[#8AA0B4] hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {!isCompletedCollapsed && (
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-start gap-3 py-1 px-0.5 rounded-lg transition-colors"
                >
                  {/* Checked Checkbox: clicking unticks and restores task to active list */}
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleUntickTask(task.id)}
                    className="w-[1.15rem] h-[1.15rem] mt-0.5 rounded-full bg-[#213A50] dark:bg-[#4B708B] border-[1.5px] border-[#213A50] dark:border-[#4B708B] flex-shrink-0 grid place-content-center text-white transition-transform active:scale-90 cursor-pointer"
                    aria-label="Untick task"
                    title="Untick task"
                  >
                    <Check size={11} strokeWidth={3} />
                  </button>

                  {/* Non-editable Strikethrough Text: cannot edit text, only untickable */}
                  <span className="flex-1 text-[15px] sm:text-base line-through text-[#8a9ba8] dark:text-[#627788] select-text cursor-default leading-relaxed">
                    {task.text}
                  </span>

                  {/* Delete completed task button */}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCompletedTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#8AA0B4] hover:text-red-500 rounded flex-shrink-0 cursor-pointer"
                      aria-label="Delete task"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generous buffer area: clicking focuses the adder input */}
      <div
        className="h-28 w-full cursor-text select-none"
        onClick={() => {
          if (!isReadOnly) {
            adderInputRef.current?.focus();
          }
        }}
        aria-hidden="true"
      />
    </div>
  );
};
