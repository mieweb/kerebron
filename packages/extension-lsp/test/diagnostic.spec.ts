import { expect, test } from '@playwright/test';

test.describe('Diagnostic', () => {
  test('should show error', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');

    const editor = page.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editor).toContainText('Javascript lsp test');

    // decorator for JS Error should be visible on load
    const errorDecoration = page.locator('.kb-lsp__error');
    // Diagnostics arrive asynchronously after LSP client init,
    // didOpen, and the language server's publishDiagnostics response.
    await expect(errorDecoration).toHaveCount(1, { timeout: 15_000 });
    await expect(errorDecoration).toHaveAttribute(
      'data-message',
      'Identifier expected.',
    );
  });
});
