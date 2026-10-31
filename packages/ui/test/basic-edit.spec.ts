import { expect, test } from '@playwright/test';

test.describe('Basic editing', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();
    await page.keyboard.type('Hello wonderful world');

    await page.keyboard.press('Enter');

    await expect(editor).toContainText('Hello wonderful world');

    // Move the caret to the beginning
    await page.keyboard.press('ArrowUp');
    // await page.keyboard.press('ControlOrMeta+ArrowLeft');
    // await page.keyboard.press('ControlOrMeta+ArrowLeft');
    // await page.keyboard.press('ControlOrMeta+ArrowLeft');

    await page.keyboard.type('test');

    // Select "Hello " using Shift + ArrowRight
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    // Cut the selected text
    await page.keyboard.press('ControlOrMeta+X');

    await expect(editor).toContainText('wonderful world');
    await expect(editor).not.toContainText('Hello');
  });

  test('inserts text at the caret position', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();
    await editor.pressSequentially('Hello world');

    // Move to the beginning of "world"
    await page.keyboard.press('ControlOrMeta+ArrowLeft');

    await page.keyboard.type('beautiful ');

    await expect(editor).toContainText('Hello beautiful world');
  });

  test('selects a specific phrase', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();
    await page.keyboard.type('The quick brown fox');

    await page.keyboard.press('Home');

    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    const selectedText = await page.evaluate(
      () => globalThis.getSelection()?.toString(),
    );

    expect(selectedText).toBe('The quick');
  });

  test('finds text then selects and gets ranges', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    const rects = await editor.evaluate((root, target) => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
      );

      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const start = node.textContent?.indexOf(target) ?? -1;

        if (start >= 0) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + target.length);

          return Array.from(range.getClientRects()).map((rect) => ({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }));
        }
      }

      return [];
    }, 'target phrase');
  });
});
