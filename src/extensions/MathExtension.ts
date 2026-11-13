import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core';
import katex from 'katex';

export interface MathBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      insertMathBlock: (latex?: string) => ReturnType;
    };
  }
}

export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math-block"]',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') || '',
        }),
      },
      // Automatically detect and convert raw $$...$$ inside paragraphs
      {
        tag: 'p',
        getAttrs: (dom) => {
          const text = (dom as HTMLElement).textContent?.trim() || '';
          const match = text.match(/^\$\$([\s\S]+?)\$\$$/) || text.match(/^\\\[([\s\S]+?)\\\]$/);
          if (match) {
            return { latex: match[1].trim() };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const latex = node.attrs.latex || '';
    let rendered = '';
    if (latex) {
      try {
        rendered = katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (_) {
        rendered = `<span class="katex-error">${latex}</span>`;
      }
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'math-block',
        'data-latex': latex,
        class: 'katex-math-block my-3 text-center py-2 px-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]',
      }),
      ['div', { class: 'katex-math-render' }, ['raw', rendered]],
    ];
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex: latex ?? '',
            },
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$([\s\S]+?)\$\$$/,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1].trim(),
        }),
      }),
      nodeInputRule({
        find: /^\\\[([\s\S]+?)\\\]$/,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1].trim(),
        }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\$\$([\s\S]+?)\$\$/g,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1].trim(),
        }),
      }),
      nodePasteRule({
        find: /\\\[([\s\S]+?)\\\]/g,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1].trim(),
        }),
      }),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className =
        'katex-math-block group relative my-3 p-3 rounded-xl border border-[#DFD3C0] dark:border-[#2A3B4C] bg-[#FAF6EF]/70 dark:bg-[#16202A]/70 text-center select-none cursor-pointer hover:border-apple-yellow dark:hover:border-[#7EAAD0] transition-all';
      dom.setAttribute('data-type', 'math-block');
      dom.setAttribute('data-latex', node.attrs.latex);

      let isEditing = false;
      let currentLatex = node.attrs.latex || '';

      const renderView = () => {
        dom.innerHTML = '';

        if (isEditing) {
          const editWrapper = document.createElement('div');
          editWrapper.className = 'flex items-center gap-2 p-1 text-left';

          const input = document.createElement('input');
          input.type = 'text';
          input.className =
            'flex-1 px-3 py-1.5 font-mono text-xs rounded-lg border border-[#DFD3C0] dark:border-[#2C4054] bg-white dark:bg-[#121A22] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:ring-1 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0]';
          input.value = currentLatex;
          input.placeholder = 'Type LaTeX formula (e.g. \\frac{a}{b} = c)...';

          const finishEditing = () => {
            isEditing = false;
            currentLatex = input.value.trim();
            dom.setAttribute('data-latex', currentLatex);
            if (typeof getPos === 'function') {
              editor.commands.command(({ tr }) => {
                const pos = getPos();
                if (typeof pos === 'number') {
                  tr.setNodeMarkup(pos, undefined, { latex: currentLatex });
                }
                return true;
              });
            }
            renderView();
          };

          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              finishEditing();
            }
          });

          input.addEventListener('blur', () => {
            finishEditing();
          });

          const doneBtn = document.createElement('button');
          doneBtn.type = 'button';
          doneBtn.className =
            'px-3 py-1.5 text-xs font-semibold rounded-md bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs hover:opacity-90 transition-opacity';
          doneBtn.textContent = 'Done';
          doneBtn.onmousedown = (e) => e.preventDefault();
          doneBtn.onclick = (e) => {
            e.stopPropagation();
            finishEditing();
          };

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className =
            'px-2.5 py-1.5 text-xs font-semibold rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors';
          deleteBtn.textContent = 'Delete';
          deleteBtn.title = 'Delete Formula';
          deleteBtn.onmousedown = (e) => e.preventDefault();
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof getPos === 'function') {
              const pos = getPos();
              if (typeof pos === 'number') {
                editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
                return;
              }
            }
            dom.remove();
          };

          editWrapper.appendChild(input);
          editWrapper.appendChild(doneBtn);
          editWrapper.appendChild(deleteBtn);
          dom.appendChild(editWrapper);

          setTimeout(() => {
            input.focus();
            input.select();
          }, 20);
        } else {
          const mathContainer = document.createElement('div');
          mathContainer.className =
            'katex-formula py-1 px-2 overflow-x-auto text-base text-[#1C2B36] dark:text-[#E8EEF3]';
          if (!currentLatex) {
            mathContainer.innerHTML = '<span class="text-xs text-[#8AA0B4] italic font-sans select-none">$$ Type or paste math formula $$</span>';
          } else {
            try {
              mathContainer.innerHTML = katex.renderToString(currentLatex, {
                displayMode: true,
                throwOnError: false,
              });
            } catch (err) {
              mathContainer.innerHTML = `<span class="text-xs text-red-500 font-mono">${currentLatex}</span>`;
            }
          }

          const badge = document.createElement('span');
          badge.className =
            'absolute top-1.5 right-2 text-[10px] text-[#8AA0B4] opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded pointer-events-none select-none';
          badge.textContent = 'Click to edit · Right click to delete';

          dom.appendChild(mathContainer);
          dom.appendChild(badge);
        }
      };

      dom.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        if (!isEditing && editor.isEditable) {
          isEditing = true;
          renderView();
        }
      });

      renderView();

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;
          currentLatex = updatedNode.attrs.latex;
          dom.setAttribute('data-latex', currentLatex);
          if (!isEditing) renderView();
          return true;
        },
      };
    };
  },
});

