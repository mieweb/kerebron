import { expect, test } from '@playwright/test';

test.describe('Kerebron Editor2 ', () => {
  test('inserts text at the caret position', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]');

    await editor.focus();
    await editor.pressSequentially('Hello world');

    // Move to the beginning of "world"
    await page.keyboard.press('ControlOrMeta+ArrowLeft');

    await page.keyboard.type('beautiful ');

    await expect(editor).toContainText('Hello beautiful world');
  });

  test('selects a specific phrase', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]');

    await editor.focus();
    await page.keyboard.type('The quick brown fox');

    await page.keyboard.press('Home');

    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    const selectedText = await page.evaluate(
      () => window.getSelection()?.toString(),
    );

    expect(selectedText).toBe('The quick');
  });

  test('aaaaa', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]');
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

  test('cuts selected text and updates clipboard', async ({ page, context }) => {
    await context.grantPermissions([
      'clipboard-read',
      'clipboard-write',
    ]);

    const editor = page.locator('[contenteditable="true"]');

    await editor.focus();
    await page.keyboard.type('Hello world');

    // Select "world"
    await page.keyboard.press('ControlOrMeta+ArrowRight');
    await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');

    await page.keyboard.press('ControlOrMeta+X');

    await expect(editor).toContainText('Hello');

    const clipboard = await page.evaluate(
      () => navigator.clipboard.readText(),
    );

    expect(clipboard).toBe('world');
  });

  test('applies bold to selected text', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]');

    await editor.focus();
    await page.keyboard.type('make this bold');

    await page.keyboard.press('ControlOrMeta+ArrowLeft');

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    await page.getByRole('button', { name: /bold/i }).click();

    await expect(editor.locator('strong')).toContainText('bold');
  });

  test('applies bold to selected text', async ({ page }) => {
    const editor = page.locator('[contenteditable="true"]');

    async function selectText(
      editor: import('@playwright/test').Locator,
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

          const selection = window.getSelection();
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

    await selectText(editor, 'brown fox');

    const selected = await page.evaluate(
      () => window.getSelection()?.toString(),
    );

    expect(selected).toBe('brown fox');

    await page.keyboard.press('ControlOrMeta+X');
  });
});
