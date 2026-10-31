import { expect, Locator, test } from '@playwright/test';

test.describe('Clipboard ', () => {
  test('cuts selected text and updates clipboard', async ({ page, context }) => {
    await context.grantPermissions([
      'clipboard-read',
      'clipboard-write',
    ]);

    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+X');

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

  test('cuts all text and updates clipboard', async ({ page, context }) => {
    return; // TODO markdown copy implemention
    await context.grantPermissions([
      'clipboard-read',
      'clipboard-write',
    ]);

    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await editor.focus();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+X');

    await expect(editor).toContainText('');

    const clipboard = await page.evaluate(
      () => navigator.clipboard.readText(),
    );

    expect(clipboard).toBe('world');
  });
});
