import { expect, test } from '@playwright/test';

test.describe('Markdown preview', () => {
  test('should highlight text selected inside the code block', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');
    const editor = page.locator('.kb-editor');
    await expect(editor).toContainText('Javascript lsp test');
    // Let the initial workspace snapshot and LSP diagnostics settle.
    await expect(page.locator('.kb-lsp__error')).toHaveCount(1, {
      timeout: 15_000,
    });

    // Focus the code block and wait for the preview to have content.
    const codeBlock = page.locator('.codecrock[contenteditable]').first();
    await codeBlock.click();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.getElementById('markdown')?.textContent?.length ?? 0
        )
      )
      .toBeGreaterThan(50);

    // Select `console.warn` (12 chars) on the last code line.
    await page.keyboard.press('ArrowDown'); // to the second code line
    await page.waitForTimeout(150);
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(300);

    // The preview must highlight the same raw text.
    const selected = page.locator('#markdown .md-selected');
    await expect(selected).toHaveText('console.warn');

    // And the highlight must sit inside the fenced code block.
    const preview = page.locator('#markdown');
    await expect(preview).toContainText('console.warn("TEST");');
  });
});
