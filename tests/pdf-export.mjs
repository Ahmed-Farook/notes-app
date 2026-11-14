// Run with Vite on http://127.0.0.1:5173 and Playwright installed.
// TEXO_PLAYWRIGHT_MODULE / TEXO_CHROMIUM_PATH can use a preinstalled browser runtime.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.TEXO_PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.TEXO_PDF_TEST_OUTPUT || 'test-results/pdf');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.TEXO_CHROMIUM_PATH || undefined,
  args: process.env.TEXO_CHROMIUM_ARGS ? JSON.parse(process.env.TEXO_CHROMIUM_ARGS) : ['--no-sandbox'],
});

const icon = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="90"><rect width="240" height="90" fill="#296d8c"/><circle cx="55" cy="45" r="25" fill="#ffce62"/><text x="95" y="52" fill="white" font-family="Arial" font-size="18">Image retained</text></svg>').toString('base64');
const task = (checked, text) => `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${checked ? 'checked' : ''}><span></span></label><div><p>${text}</p></div></li>`;
const table = '<table><tbody><tr><th><p>Item</p></th><th><p>Expected</p></th></tr>' +
  Array.from({ length: 15 }, (_, i) => `<tr><td><p>Row ${i + 1}</p></td><td><p>Spacing and cell padding preserved.</p></td></tr>`).join('') + '</tbody></table>';
const note = {
  id: 'pdf-test-note', title: 'PDF export verification', folderId: 'default', isPinned: false,
  plainTextPreview: 'Synthetic regression fixture', createdAt: 1, updatedAt: 1,
  content: '<h1>PDF export verification</h1>' +
    '<p>This paragraph contains ordinary spaces, <strong>bold words</strong>, <em>italic words</em>, <u>underlining</u>, and <mark>highlighted text</mark>. Its wrapping should match the editor.</p>' +
    '<p></p><p></p><p>Two blank paragraphs remain above this line.<br>A manual line break remains here.</p>' +
    '<h2>Lists and checkboxes</h2><ul><li><p>A bulleted item</p><ul><li><p>A nested bullet</p></li></ul></li></ul>' +
    '<ol start="3"><li><p>Numbering starts at three</p></li><li><p>Second item</p></li></ol>' +
    `<ul data-type="taskList">${task(true, 'Completed task')}${task(false, 'An unchecked task with enough words to wrap onto another line on a narrow screen.')}</ul>` +
    '<blockquote><p>A quotation with its own indentation.</p></blockquote>' +
    '<pre><code>const answer = 42;\n    // Four spaces of indentation\nconsole.log(answer);</code></pre>' +
    '<h3>Formula and image</h3><div data-type="math-block" data-latex="\\frac{1}{2} + \\sqrt{x^2+y^2} = \\sum_{i=1}^{n} i"></div>' +
    `<img src="${icon}">` + table +
    Array.from({ length: 24 }, (_, i) => `<p>Paragraph ${i + 1}: normal text with spaces. ${'This sentence should wrap at spaces, keep its line height, and never be cut through its letters. '.repeat(3)}</p>`).join('') +
    '<p>END OF NOTE — all content retained.</p>',
  drawingStrokes: JSON.stringify([
    { id: 'line', tool: 'pen', color: '#c33653', size: 3, points: [{ x: 10, y: 40 }, { x: 60, y: 40 }, { x: 100, y: 40 }] },
    { id: 'highlight', tool: 'highlighter', color: '#f0b326', size: 7, points: [{ x: 10, y: 80 }, { x: 110, y: 80 }] },
  ]),
};

const context = await browser.newContext();
const results = [];
try {
  for (const mode of [{ name: 'desktop', width: 1440, height: 1000, theme: 'light' }, { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' }].filter(m => !process.env.TEXO_PDF_TEST_MODE || process.env.TEXO_PDF_TEST_MODE === m.name)) {
    const page = await context.newPage();
    await page.setViewportSize({ width: mode.width, height: mode.height });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.addInitScript(({ note, theme }) => {
      localStorage.setItem('apple_notes_data_v1', JSON.stringify([note]));
      localStorage.setItem('apple_notes_theme', theme);
    }, { note, theme: mode.theme });
    await page.goto('http://127.0.0.1:5173');
    await page.getByText(note.title, { exact: true }).and(page.locator(':visible')).first().click();
    await page.locator('[data-pdf-note-id] .tiptap:visible').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-pdf-note-id] .tiptap:visible').screenshot({ path: `${out}/${mode.name}-editor.png` });

    const comparison = await page.evaluate(async note => {
      const { prepareNoteForPdf, getPdfPageSlices } = await import('/src/utils/notePdf.ts');
      const source = Array.from(document.querySelectorAll('[data-pdf-note-id] .tiptap')).find(el => el.getBoundingClientRect().width > 0);
      const original = source.outerHTML;
      const snapshot = await prepareNoteForPdf(note);
      window.testSnapshot = snapshot;
      function metrics(root) {
        const origin = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll('h1,h2,h3,p,li,td,th,pre,img,.katex-math-block')).map(el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { tag: el.tagName, text: el.textContent, x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height, font: s.font, margin: s.margin, whiteSpace: s.whiteSpace };
        });
      }
      const a = metrics(source), b = metrics(snapshot.prose);
      const differences = a.flatMap((item, i) => {
        const other = b[i];
        if (!other) return [{ i, missing: true }];
        return Object.keys(item).flatMap(k => k === 'text' ? [] :
          (typeof item[k] === 'number' ? Math.abs(item[k] - other[k]) > 0.1 : item[k] !== other[k]) ? [{ i, key: k, source: item[k], snapshot: other[k] }] : []);
      });
      const sourceWrapper = source.closest('[data-pdf-note-id]').parentElement;
      const sourceOffset = source.getBoundingClientRect().top - sourceWrapper.getBoundingClientRect().top;
      const snapshotOffset = snapshot.prose.getBoundingClientRect().top - snapshot.viewport.getBoundingClientRect().top;
      const coverage = getPdfPageSlices(350, 100, [{ top: 90, bottom: 110 }, { top: 180, bottom: 205 }]);
      // Verify the library's final SVG too: its default font-size rounding can
      // change wrapping even when the offscreen HTML matches perfectly.
      const { toSvg, getFontEmbedCSS } = await import('/node_modules/.vite/deps/html-to-image.js');
      const svg = await toSvg(snapshot.viewport, {
        fontEmbedCSS: (await getFontEmbedCSS(snapshot.viewport, { preferredFontFormat: 'woff2' })) + '\n' + snapshot.fontSizeCSS,
      });
      const frame = document.createElement('iframe');
      Object.assign(frame.style, { position: 'fixed', left: '-100000px', width: `${snapshot.width}px`, height: `${snapshot.height}px` });
      document.body.appendChild(frame);
      await new Promise(resolve => {
        frame.onload = resolve;
        frame.srcdoc = '<body style="margin:0">' + decodeURIComponent(svg.slice(svg.indexOf(',') + 1));
      });
      await frame.contentDocument.fonts.ready;
      const rendered = frame.contentDocument.querySelector('.tiptap');
      const renderedRect = rendered.getBoundingClientRect();
      const renderedElements = rendered.querySelectorAll('[data-pdf-font]');
      const finalDifferences = Array.from(snapshot.prose.querySelectorAll('[data-pdf-font]')).flatMap((el, i) => {
        const copy = renderedElements[i];
        if (!copy) return [{ i, missing: true }];
        const sourceStyle = getComputedStyle(el);
        const renderedStyle = frame.contentWindow.getComputedStyle(copy);
        const rect = el.getBoundingClientRect(), other = copy.getBoundingClientRect();
        const sourceRect = snapshot.prose.getBoundingClientRect();
        // Embedded KaTeX fonts have up to a one-pixel glyph-box difference in
        // Chromium's isolated SVG document. Block geometry stays strict.
        const tolerance = el.closest('.katex') ? 1.1 : 0.1;
        return ['fontSize', 'fontFamily', 'lineHeight'].filter(k => sourceStyle[k] !== renderedStyle[k]).map(k => ({ i, key: k, before: sourceStyle[k], after: renderedStyle[k] })).concat(
          Math.abs(rect.y - sourceRect.y - (other.y - renderedRect.y)) > tolerance ? [{ i, key: 'y', before: rect.y - sourceRect.y, after: other.y - renderedRect.y }] : [],
        );
      });
      frame.remove();
      const inactive = await prepareNoteForPdf({ ...note, id: 'inactive-rich-note' });
      const inactiveMetrics = metrics(inactive.prose);
      const inactiveDifferences = a.flatMap((item, i) => {
        const other = inactiveMetrics[i];
        if (!other) return [{ i, missing: true }];
        return ['x', 'y', 'width', 'height'].filter(k => Math.abs(item[k] - other[k]) > 0.1).map(k => ({ i, key: k, source: item[k], fallback: other[k] }));
      });
      inactive.dispose();
      return {
        differences, finalDifferences, inactiveDifferences, count: a.length, snapshotCount: b.length, sourceOffset, snapshotOffset,
        unchanged: source.outerHTML === original,
        spacesPreserved: snapshot.prose.textContent.includes('ordinary spaces'),
        checkboxes: Array.from(snapshot.prose.querySelectorAll('input[type="checkbox"]')).map(el => el.checked),
        coverage, width: snapshot.width, height: snapshot.height,
      };
    }, note);
    // Bring only the throwaway snapshot into view for a screenshot; never alter the real editor.
    await page.evaluate(() => { window.testSnapshot.viewport.parentElement.style.left = '0'; });
    await page.locator('[data-pdf-snapshot] .tiptap').screenshot({ path: `${out}/${mode.name}-snapshot.png` });
    await page.evaluate(() => window.testSnapshot.dispose());
    console.log(mode.name, JSON.stringify({ ...comparison, finalDifferences: comparison.finalDifferences.slice(0, 20), finalDifferenceCount: comparison.finalDifferences.length }));
    assert.equal(comparison.unchanged, true);
    assert.equal(comparison.spacesPreserved, true);
    assert.deepEqual(comparison.checkboxes, [true, false]);
    assert.equal(comparison.count, comparison.snapshotCount);
    assert.deepEqual(comparison.differences, []);
    assert.deepEqual(comparison.finalDifferences, []);
    assert.deepEqual(comparison.inactiveDifferences, []);
    assert.ok(Math.abs(comparison.sourceOffset - comparison.snapshotOffset) < 0.1, 'Drawing/text coordinate origins must match');
    assert.deepEqual(comparison.coverage, [{ start: 0, end: 90 }, { start: 90, end: 180 }, { start: 180, end: 280 }, { start: 280, end: 350 }]);

    const pdf = await page.evaluate(async note => {
      const { generateNotePdfBlob } = await import('/src/utils/notePdf.ts');
      const blob = await generateNotePdfBlob(note);
      if (document.querySelector('[data-pdf-snapshot]')) throw new Error('Export did not clean up its snapshot.');
      return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), size: blob.size };
    }, note);
    await writeFile(`${out}/${mode.name}.pdf`, Buffer.from(pdf.bytes));
    assert.equal(Buffer.from(pdf.bytes).subarray(0, 5).toString(), '%PDF-');
    results.push({ mode: mode.name, elementsCompared: comparison.count, pdfBytes: pdf.size });

    if (mode.name === 'desktop') {
      const otherChecks = await page.evaluate(async note => {
        const { prepareNoteForPdf, generateNotePdfBlob, getPdfPageSlices } = await import('/src/utils/notePdf.ts');
        const other = { ...note, id: 'not-the-open-note', title: 'Other note', content: '<p>Keep this as a paragraph, not a heading.</p><p></p><p>Final line.</p>', drawingStrokes: undefined };
        const snapshot = await prepareNoteForPdf(other);
        const firstTag = snapshot.prose.firstElementChild.tagName;
        const text = snapshot.prose.textContent;
        snapshot.dispose();
        const otherBlob = await generateNotePdfBlob(other);
        const emptyBlob = await generateNotePdfBlob({ ...other, content: '<p></p>' });
        let invalidRejected = false;
        try { await generateNotePdfBlob({ ...other, drawingStrokes: '{invalid' }); } catch { invalidRejected = true; }
        let missingImageRejected = false;
        try { await generateNotePdfBlob({ ...other, content: '<p>Missing image</p><img src="/missing-test-image.png">' }); } catch { missingImageRejected = true; }
        const oversized = getPdfPageSlices(1000, 100, [{ top: 10, bottom: 900 }]);
        return {
          firstTag, text, invalidRejected, missingImageRejected,
          leaked: Boolean(document.querySelector('[data-pdf-snapshot]')),
          oversizedEnd: oversized.at(-1).end,
          other: Array.from(new Uint8Array(await otherBlob.arrayBuffer())),
          empty: Array.from(new Uint8Array(await emptyBlob.arrayBuffer())),
        };
      }, note);
      assert.equal(otherChecks.firstTag, 'P');
      assert.ok(otherChecks.text.startsWith('Keep this as a paragraph'));
      assert.equal(otherChecks.invalidRejected, true);
      assert.equal(otherChecks.missingImageRejected, true);
      assert.equal(otherChecks.leaked, false);
      assert.equal(otherChecks.oversizedEnd, 1000);
      await writeFile(`${out}/other-note.pdf`, Buffer.from(otherChecks.other));
      await writeFile(`${out}/empty-note.pdf`, Buffer.from(otherChecks.empty));
    }
    await page.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log('PDF export checks passed:', JSON.stringify(results));
} finally {
  await browser.close();
}
