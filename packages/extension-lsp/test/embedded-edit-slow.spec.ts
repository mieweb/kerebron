import { expect, test } from '@playwright/test';

test.describe('Basic editing slow', () => {
  test('should edit embedded code slowly', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');

    const editor = page.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editor).toContainText('Javascript lsp test');

    await editor.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.type('console.log(1);', { delay: 500 });

    await expect(editor).toContainText('console.log(1);');
  });
});
