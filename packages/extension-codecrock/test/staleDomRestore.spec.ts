import { expect, test } from '@playwright/test';

// Regression test for NodeViewCodeCrock.update()
// (packages/extension-codecrock/src/NodeViewCodeCrock.ts).
//
// Guard history: update() used to skip syncing the DOM when the incoming
// doc text equaled the text last pushed from CodeCrock to ProseMirror
// (lastPushed, an equality-based echo-suppression guard). That failed on
// the ABA pattern: type 'A' (lastPushed = 'A' + base), external txn replaces
// the block with 'B', external txn / undo restores 'A + base' — the restore
// equaled lastPushed, so the guard skipped the sync and the DOM stayed at
// 'B' while the doc said 'A + base'. The next keystroke then pushed the stale
// DOM text through valueChanged() and overwrote the restored document.
//
// The lastPushed shortcut was removed; only IME composition may skip
// syncing. Echo transactions are a no-op via computeChange() returning
// null when DOM text already matches the doc. This test pins that: after
// an external replace + restore, the focused DOM must resync, and the next
// keystroke must build on the restored document.
test.describe('CodeCrock stale DOM after external restore', () => {
  test('external restore of previously typed text must resync the focused CodeCrock DOM', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');
    const editor = page.locator('.kb-editor');
    await expect(editor).toContainText('Javascript lsp test');
    // Let the initial workspace snapshot and LSP diagnostics settle.
    await expect(page.locator('.kb-lsp__error')).toHaveCount(1, {
      timeout: 15_000,
    });

    // Text of the first code_block, read from the ProseMirror state. The
    // CodeCrock DOM rendering may differ in whitespace (leading newline).
    const getDocText = () =>
      page.evaluate(() => {
        const editor = (document.querySelector('.kb-component') as any)
          .editor;
        let text: string | undefined;
        editor.state.doc.descendants((node: any) => {
          if (text === undefined && node.type.name === 'code_block') {
            text = node.textContent;
          }
          return true;
        });
        return text ?? '';
      });

    // Text of the first code block, read from the CodeCrock DOM (not from
    // the ProseMirror state) so DOM/state divergence is observable.
    const getDomText = () =>
      page.evaluate(() => {
        const el = document.querySelector('.codecrock[contenteditable]');
        return el?.textContent ?? '';
      });

    // Replace the whole first code_block through a dispatched transaction,
    // the way a remote collaborator (or any other external source) would.
    const replaceFirstCodeBlock = (text: string) =>
      page.evaluate((text: string) => {
        const editor = (document.querySelector('.kb-component') as any)
          .editor;
        let codeStart = -1;
        let codeEnd = -1;
        editor.state.doc.descendants((node: any, pos: number) => {
          if (codeStart < 0 && node.type.name === 'code_block') {
            codeStart = pos + 1;
            codeEnd = pos + node.nodeSize - 1;
          }
          return true;
        });
        if (codeStart < 0) throw new Error('no code_block found');
        const tr = editor.state.tr.replaceWith(
          codeStart,
          codeEnd,
          editor.state.schema.text(text),
        );
        editor.view.dispatch(tr);
      }, text);

    const codeBlock = page.locator('.codecrock[contenteditable]').first();

    // Focus the first code block and type 'A' at its start. This is the
    // keystroke whose echo transaction the old lastPushed guard suppressed.
    await codeBlock.click();
    await page.keyboard.press('Home');
    await page.keyboard.type('A');
    await expect
      .poll(getDocText, { timeout: 15_000 })
      .toContain('A');
    const typedText = await getDocText();

    // External transaction #1: replace the block with 'B'.
    // 'B' !== lastPushed, so the NodeView syncs the focused DOM to 'B'.
    await replaceFirstCodeBlock('B');
    await expect
      .poll(getDomText, { timeout: 5_000 })
      .toBe('B');

    // External transaction #2: restore the typed text. The old guard
    // wrongly skipped the sync here (restore === lastPushed), leaving the
    // DOM at 'B' while the document said typedText.
    await replaceFirstCodeBlock(typedText);

    await expect
      .poll(getDocText, { timeout: 5_000 })
      .toBe(typedText);

    // The focused CodeCrock DOM must resync to the restored document,
    // otherwise a later keystroke would push stale DOM text back into it.
    await expect
      .poll(getDomText, { timeout: 5_000 })
      .toBe(typedText);

    // The next keystroke must build on the restored document. Currently
    // the stale DOM ('B') is pushed through valueChanged and overwrites
    // the restored text.
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect
      .poll(getDocText, { timeout: 5_000 })
      .toBe(typedText + '!');
    await expect
      .poll(getDomText, { timeout: 5_000 })
      .toBe(typedText + '!');
  });
});
