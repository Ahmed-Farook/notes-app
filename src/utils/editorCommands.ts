import { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Toggle code block so that when multiple paragraphs or lines are selected,
 * all selected text is merged into a single code block with line breaks,
 * rather than creating a separate code block for each line.
 */
export const toggleUnifiedCodeBlock = (editor: Editor) => {
  const { state, dispatch } = editor.view;
  const { from, to, empty } = state.selection;
  const $from = state.doc.resolve(from);

  // 1. If currently inside a codeBlock, toggle it back into paragraphs
  let isInsideCode = false;
  let codeDepth = 0;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'codeBlock') {
      isInsideCode = true;
      codeDepth = d;
      break;
    }
  }

  if (isInsideCode) {
    const codeNode = $from.node(codeDepth);
    const start = $from.before(codeDepth);
    const end = $from.after(codeDepth);
    const lines = codeNode.textContent.split('\n');
    const paragraphs = lines.map(line =>
      state.schema.nodes.paragraph.create(null, line ? state.schema.text(line) : undefined)
    );
    const tr = state.tr.replaceWith(start, end, paragraphs);
    dispatch(tr);
    editor.view.focus();
    return;
  }

  const codeBlockType = state.schema.nodes.codeBlock;
  if (!codeBlockType) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  // 2. If selection is empty, create an empty code block at current cursor position
  if (empty) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  // 3. Selection is not empty: combine all selected blocks into a SINGLE code block
  const $to = state.doc.resolve(to);
  const blockStart = $from.before(1);
  const blockEnd = $to.after(1);
  const fullText = state.doc.textBetween(blockStart, blockEnd, '\n');
  const textNode = fullText ? state.schema.text(fullText) : undefined;
  const codeBlockNode = codeBlockType.create(null, textNode);
  const tr = state.tr.replaceWith(blockStart, blockEnd, codeBlockNode);

  const selPos = Math.min(tr.doc.content.size - 1, blockStart + 1);
  tr.setSelection(TextSelection.create(tr.doc, selPos, selPos + (fullText ? fullText.length : 0)));
  dispatch(tr);
  editor.view.focus();
};

