import { expect, test } from '@playwright/test';

test.describe('Autocomplete', () => {
  test('should use dropdown', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');

    const editor = page.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editor).toContainText('Javascript lsp test');

    await editor.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.type('console.');

    // Trigger manual completion (ctrl-space).
    await page.keyboard.press('ControlOrMeta+ ');

    // The LSP server responds asynchronously; the completion items are
    // rendered as a dropdown list popup.
    const dropdown = page.locator('.kb-popup select');
    await expect(dropdown).toBeVisible({ timeout: 15_000 });

    // ArrowDown moves the focus from the editor into the dropdown and
    // selects the first item.
    await page.keyboard.press('ArrowDown');
    const selectedValue = await dropdown.evaluate(
      (select: HTMLSelectElement) => {
        if (select.selectedIndex !== 0) {
          throw new Error('Expected the first item to be selected');
        }
        return select.selectedOptions[0].value;
      },
    );

    // Enter picks the selected item and inserts it at the cursor.
    await page.keyboard.press('Enter');

    await expect(editor).toContainText('console.' + selectedValue, {
      timeout: 15_000,
    });
    // The popup closes after the selection is inserted.
    await expect(page.locator('.kb-popup')).toHaveCount(0);
  });
});
