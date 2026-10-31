import { expect, type Locator, test } from '@playwright/test';

test.describe('Formatting tests ', () => {
  test('applies bold to entered text', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+X');

    await page.keyboard.type('make this bold');

    await page.keyboard.press('ControlOrMeta+ArrowLeft');

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    await page.getByRole('button', { name: /bold/i }).click();

    await expect(editor.locator('strong')).toContainText('bold');
  });

  test('applies bold to specific text', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    async function selectText(
      editor: Locator,
      target: string,
    ) {
      const found = await editor.evaluate((root, text) => {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
        );

        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const start = node.textContent?.indexOf(text) ?? -1;

          if (start < 0) continue;

          const selection = globalThis.getSelection();
          if (!selection) return false;

          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + text.length);

          selection.removeAllRanges();
          selection.addRange(range);

          return true;
        }

        return false;
      }, target);

      if (!found) {
        throw new Error(`Text not found in editor: ${target}`);
      }
    }

    await selectText(editor, 'menu item');

    const selected = await page.evaluate(
      () => globalThis.getSelection()?.toString(),
    );

    expect(selected).toBe('menu item');

    await page.keyboard.press('ControlOrMeta+X');
  });
});
