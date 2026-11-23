import { expect, type Page } from '@playwright/test';

/** Wait until the example document has finished loading asynchronously. */
export async function waitForDocLoad(page: Page) {
  await expect(page.locator('h2', { hasText: 'Code test' })).toBeVisible();
}

/**
 *  Wait for the browser selection to settle to the given text.
 *  It is for webkit
 */
export async function expectSelection(page: Page, text: string) {
  await expect.poll(() =>
    page.evaluate(() => globalThis.getSelection()?.toString())
  ).toBe(text);
}

/** Wait for the async document load, focus the editor, then clear it. */
export async function clearEditor(page: Page) {
  const editor = page.locator('.kb-editor');
  await editor.focus();
  await waitForDocLoad(page);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
}
