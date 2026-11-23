import { expect, test } from '@playwright/test';
import { waitForPreview } from './editor.ts';

test.describe('Markdown preview', () => {
  test('should highlight the selected text at the right markdown position', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');
    const editor = page.locator('.kb-editor');
    await expect(editor).toContainText('Javascript lsp test');

    await waitForPreview(page, 'Javascript lsp test');

    // Select the first 10 chars of the heading ("Javascript").
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    // The preview must highlight the same text in the raw markdown,
    // i.e. "Javascript" right after the "## " prefix of the heading.
    const selected = page.locator('#markdown .md-selected');
    await expect(selected).toHaveText('Javascript');
    const preview = page.locator('#markdown');
    await expect(preview).toContainText('## Javascript lsp test');
  });
});
