import { expect, type Page } from '@playwright/test';

/**
 * Wait until the debounced workspace snapshot has reached the markdown
 * preview. The first selection event may fire before the snapshot exists,
 * so keep clicking the heading until the preview shows `text`.
 */
export async function waitForPreview(page: Page, text: string) {
  const heading = page.locator('.kb-editor').getByText(text).first();
  await expect.poll(
    async () => {
      await heading.click();
      return await page.evaluate(
        () => document.getElementById('markdown')?.textContent ?? '',
      );
    },
    { timeout: 10_000 },
  ).toContain(text);
}
