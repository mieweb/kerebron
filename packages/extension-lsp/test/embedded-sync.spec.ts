import { expect, test } from '@playwright/test';

test.describe('Code block sync', () => {
  test('should sync typed char into the document synchronously', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');

    const editor = page.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editor).toContainText('Javascript lsp test');

    await editor.focus();
    await page.keyboard.press('ArrowDown');

    // Wait for the caret to enter the code block.
    await page.waitForFunction(() => {
      const codeCrock = document.querySelector('.codecrock');
      return codeCrock === document.activeElement;
    });

    // Record the document content at keyup time. The CodeCrock keyup
    // handler (element listener) runs before this document listener, so a
    // synchronous sync has already updated the ProseMirror document. A
    // debounced sync would leave the document without the typed character
    // here, and async transactions (selection forwarding, LSP diagnostics)
    // could then revert it. 'Z' is not part of the initial document.
    await page.evaluate(() => {
      (globalThis as any).__docHasCharAtKeyup = undefined;
      document.addEventListener('keyup', () => {
        const editor = (document.querySelector('.kb-component') as any)
          .editor;
        (globalThis as any).__docHasCharAtKeyup = editor.view.state.doc
          .textContent.includes('Z');
      }, { once: true });
    });

    await page.keyboard.type('Z');

    const syncedAtKeyup = await page.evaluate(
      () => (globalThis as any).__docHasCharAtKeyup,
    );
    expect(syncedAtKeyup).toBe(true);

    await expect(editor).toContainText('Z');
  });
});
