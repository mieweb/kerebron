import { expect, Locator, test } from '@playwright/test';
import { clearEditor, expectSelection } from './editor.ts';

test.describe('Clipboard ', () => {
  // Playwright only supports clipboard permissions in Chromium
  test.skip(({ browser }) => browser.browserType().name() !== 'chromium');

  test('cuts selected text and updates clipboard', async ({ page, context }) => {
    await context.grantPermissions([
      'clipboard-read',
      'clipboard-write',
    ]);

    await page.goto('/examples-frame/browser-ui/');

    const editor = page.locator('.kb-editor');

    await clearEditor(page);

    await page.keyboard.type('Hello world');

    // Select "world"
    await page.keyboard.press('ControlOrMeta+ArrowRight');
    await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');

    await expectSelection(page, 'world');

    await page.keyboard.press('ControlOrMeta+X');

    await expect(editor).toContainText('Hello');

    const clipboard = await page.evaluate(
      () => navigator.clipboard.readText(),
    );

    expect(clipboard).toBe('world');
  });

  // TODO markdown copy implemention
  test.fixme('cuts all text and updates clipboard', async ({ page, context }) => {
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
