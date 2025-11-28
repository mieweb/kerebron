import { expect, test } from '@playwright/test';

test.describe('Kerebron React Editor', () => {
  test('should load the main page', async ({ page }) => {
    // Navigate to the React example served by server-deno-hono
    await page.goto('/examples-frame/browser-react/');

    // Check for the main heading
    await expect(page.getByRole('heading', { name: 'Yjs + React Demo' }))
      .toBeVisible();

    // Check for the "New Room" button
    await expect(page.getByRole('button', { name: 'New Room' })).toBeVisible();

    // Check for the initial message
    await expect(page.getByText('No rooms yet. Create one above!'))
      .toBeVisible();
    await expect(
      page.getByText(
        'Select a room or create a new one to start editing collaboratively',
      ),
    ).toBeVisible();
  });

  test('should create a new room and load the editor', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Click the "New Room" button
    await page.getByRole('button', { name: 'New Room' }).click();

    // Wait for the URL to change to include a room hash
    await expect(page).toHaveURL(/#room:/);

    // Check that the editor toolbar is visible
    await expect(page.getByRole('button', { name: 'Toggle strong assets' }))
      .toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle emphasis' }))
      .toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle underline' }))
      .toBeVisible();

    // Check for the markdown output section
    await expect(page.getByRole('heading', { name: 'Markdown Output' }))
      .toBeVisible();
  });

  test('should allow typing text in the editor', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Click in the editor content area (not the toolbar)
    const editorContent = page.locator('.kb-editor');
    await expect(editorContent).toBeVisible();
    await editorContent.click();

    // Type some text
    await page.keyboard.type('Hello Playwright!');

    // Check that the text appears in the editor
    await expect(editorContent).toContainText('Hello Playwright!');

    // Check that markdown output updates
    const markdownOutput = page.locator('pre');
    await expect(markdownOutput).toContainText('Hello Playwright!');
  });

  test('should apply bold formatting', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Click in the editor and type
    const editor = page.locator('.kb-editor');
    await editor.click();
    await page.keyboard.type('Bold text');

    // Select all text
    await page.keyboard.press('ControlOrMeta+a');

    // Click the bold button
    await page.getByRole('button', { name: 'Toggle strong assets' }).click();

    // Check markdown output for bold syntax (this will wait automatically)
    const markdownOutput = page.locator('pre');
    await expect(markdownOutput).toContainText('**Bold text**');
  });

  test('should apply italic formatting', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Click in the editor and type
    const editor = page.locator('.kb-editor');
    await editor.click();
    await page.keyboard.type('Italic text');

    // Select all text
    await page.keyboard.press('ControlOrMeta+a');

    // Click the italic button
    await page.getByRole('button', { name: 'Toggle emphasis' }).click();

    // Check markdown output for italic syntax (this will wait automatically)
    const markdownOutput = page.locator('pre');
    await expect(markdownOutput).toContainText('*Italic text*');
  });

  test('should have working menu dropdowns', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Check that menu buttons are present
    await expect(page.getByRole('button', { name: 'Insert ▼' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Type ▼' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Table ▼' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  });

  test('should handle multiple paragraphs', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Click in the editor
    const editor = page.locator('.kb-editor');
    await editor.click();

    // Type first paragraph
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // Type second paragraph
    await page.keyboard.type('Second paragraph');

    // Check markdown output
    const markdownOutput = page.locator('pre');
    await expect(markdownOutput).toContainText('First paragraph');
    await expect(markdownOutput).toContainText('Second paragraph');
  });

  test('should underline text', async ({ page }) => {
    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await expect(page).toHaveURL(/#room:/);

    // Click in the editor and type
    const editor = page.locator('.kb-editor');
    await editor.click();
    await page.keyboard.type('Underlined text');

    // Select all text
    await page.keyboard.press('ControlOrMeta+a');

    // Click the underline button
    await page.getByRole('button', { name: 'Toggle underline' }).click();

    // Check markdown output for underline syntax (this will wait automatically)
    const markdownOutput = page.locator('pre');
    await expect(markdownOutput).toContainText('_Underlined text_');
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/examples-frame/browser-react/');

    // Create a new room
    await page.getByRole('button', { name: 'New Room' }).click();
    await page.waitForTimeout(2000);

    // With server-deno-hono, we shouldn't have backend errors
    // Filter out LSP connection warnings (expected when LSP is disabled)
    const unexpectedErrors = errors.filter((error) =>
      !error.includes('Not connected') &&
      !error.includes('WebSocket connection') &&
      !error.includes('Error during WebSocket handshake') &&
      error !== 'Event'
    );

    expect(unexpectedErrors).toHaveLength(0);
  });
});
