import { expect, test } from '@playwright/test';

test.describe('Code block line rendering', () => {
  test('should keep code lines on separate visual lines while typing', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');

    const editor = page.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editor).toContainText('Javascript lsp test');

    await editor.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.type('console.log(', { delay: 100 });

    const codeBlock = page.locator('.codecrock[contenteditable]').first();
    // Wait for the debounced highlight and the LSP diagnostics to settle.
    await expect(codeBlock.locator('.kb-lsp__error').first()).toBeVisible({
      timeout: 15_000,
    });

    // The <br> right after the typed "console.log(" must be preserved:
    // the typed text stays on its own line, it is not backspaced up into
    // the first code line.
    await expect(editor).toContainText('console.log(\nconsole./log', {
      useInnerText: true,
    });
    // The last code line must stay on its own line as well.
    await expect(editor).toContainText('ted\nconsole.warn', {
      useInnerText: true,
    });

    // The code block must render 3 visual lines. Newlines wrapped in a
    // diagnostic decoration (inline-block) do not break the outer line,
    // so verify the actual layout, not just the text.
    const visualLines = await codeBlock.evaluate((el) => {
      const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT,
      );
      const tops = new Set<number>();
      let node;
      while ((node = walker.nextNode())) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 || rect.height > 0) {
            tops.add(Math.round(rect.top));
          }
        }
      }
      return [...tops].sort((a, b) => a - b);
    });
    expect(visualLines).toHaveLength(3);
  });
});
