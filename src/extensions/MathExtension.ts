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
        default: '\\frac{\\partial L}{\\partial w_3} = \\delta_2 \\times x_1',
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
          const match = text.match(/^\$\$([\s\S]+?)\$\$$/);
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
    try {
      rendered = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
      });
    } catch (_) {
      rendered = `<span class="katex-error">${latex}</span>`;
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
              latex: latex ?? '\\frac{\\partial L}{\\partial w_3} = \\delta_2 \\times x_1',
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
          editWrapper.className = 'flex flex-col gap-2 p-1 text-left';

          const header = document.createElement('div');
          header.className =
            'flex items-center justify-between text-[11px] font-semibold text-[#6E8092] dark:text-[#8AA0B4] select-none';
          header.innerHTML =
            '<span>LaTeX Math Formula</span><span class="text-[10px] opacity-75">Esc to finish</span>';

          const textarea = document.createElement('textarea');
          textarea.className =
            'w-full p-2.5 font-mono text-xs rounded-lg border border-[#DFD3C0] dark:border-[#2C4054] bg-white dark:bg-[#121A22] text-[#1C2B36] dark:text-[#E8EEF3] outline-none focus:ring-1 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0] resize-y min-h-[60px]';
          textarea.value = currentLatex;
          textarea.placeholder = 'e.g. \\frac{\\partial L}{\\partial w_3} = \\delta_2 \\times x_1';

          const livePreview = document.createElement('div');
          livePreview.className =
            'p-3 bg-white/60 dark:bg-[#121A22]/60 rounded-lg border border-black/5 dark:border-white/5 min-h-[44px] flex items-center justify-center overflow-x-auto text-[#1C2B36] dark:text-[#E8EEF3]';

          const updateLive = (val: string) => {
            currentLatex = val;
            dom.setAttribute('data-latex', val);
            try {
              livePreview.innerHTML = katex.renderToString(val || '\\text{Formula...}', {
                displayMode: true,
                throwOnError: false,
              });
            } catch (err) {
              livePreview.innerHTML = `<span class="text-xs text-red-500 font-mono">${(err as any)?.message}</span>`;
            }
          };

          updateLive(currentLatex);

          textarea.addEventListener('input', () => {
            updateLive(textarea.value);
          });

          const finishEditing = () => {
            isEditing = false;
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

          textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
              e.preventDefault();
              finishEditing();
            }
          });

          const buttonRow = document.createElement('div');
          buttonRow.className = 'flex items-center justify-between mt-1 pt-1 border-t border-black/5 dark:border-white/5';

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className =
            'px-2.5 py-1 text-xs rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium';
          deleteBtn.textContent = 'Delete Formula';
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof getPos === 'function') {
              const pos = getPos();
              if (typeof pos === 'number') {
                editor.commands.deleteRange({ from: pos, to: pos + 1 });
              }
            }
          };

          const doneBtn = document.createElement('button');
          doneBtn.type = 'button';
          doneBtn.className =
            'px-3.5 py-1 text-xs font-semibold rounded-md bg-apple-yellow dark:bg-[#2C4A68] text-white shadow-xs hover:opacity-90 transition-opacity';
          doneBtn.textContent = 'Done';
          doneBtn.onclick = (e) => {
            e.stopPropagation();
            finishEditing();
          };

          buttonRow.appendChild(deleteBtn);
          buttonRow.appendChild(doneBtn);

          editWrapper.appendChild(header);
          editWrapper.appendChild(textarea);
          editWrapper.appendChild(livePreview);
          editWrapper.appendChild(buttonRow);
          dom.appendChild(editWrapper);

          setTimeout(() => {
            textarea.focus();
            textarea.select();
          }, 20);
        } else {
          const mathContainer = document.createElement('div');
          mathContainer.className =
            'katex-formula py-1 px-2 overflow-x-auto text-base text-[#1C2B36] dark:text-[#E8EEF3]';
          try {
            mathContainer.innerHTML = katex.renderToString(currentLatex || '\\text{Empty formula}', {
              displayMode: true,
              throwOnError: false,
            });
          } catch (err) {
            mathContainer.innerHTML = `<span class="text-xs text-red-500 font-mono">${currentLatex}</span>`;
          }

          const badge = document.createElement('span');
          badge.className =
            'absolute top-1.5 right-2 text-[10px] text-[#8AA0B4] opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded pointer-events-none select-none';
          badge.textContent = 'Click to edit';

          dom.appendChild(mathContainer);
          dom.appendChild(badge);
        }
      };

      dom.addEventListener('click', () => {
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

