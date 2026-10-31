import { expect, test } from '@playwright/test';

test.describe('Mouse tests', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();

    await editor.hover({
      position: { x: 50, y: 20 },
    });

    {
      const box = await editor.boundingBox();

      if (!box) throw new Error('Editor not visible');

      await page.mouse.move(
        box.x + 50,
        box.y + 20,
      );
    }

    { // Locate specific text and move mouse over it
      const targetText = 'INVALIDLONGWORDTOTESTCUSTOMSPELLCHECK';

      const box = await editor.evaluate((editor, targetText) => {
        const walker = document.createTreeWalker(
          editor,
          NodeFilter.SHOW_TEXT,
        );

        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const index = node.textContent?.indexOf(targetText) ?? -1;

          if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + targetText.length);

            const rect = range.getBoundingClientRect();

            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }
        }

        return null;
      }, targetText);

      expect(box).not.toBeNull();
      console.log(box);

      if (box) {
        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
      }
    }

    const popup = page.locator('.kb-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Word longer than 32 letters');
    // Room is auto-created on load, so URL should have room hash
    // await expect(page).toHaveURL(/#room:/);
  });
});
