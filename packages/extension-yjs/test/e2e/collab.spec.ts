import { Browser, expect, test } from '@playwright/test';
import { chromium } from '@playwright/test';

import { joinRoom, waitForDocsEqual, waitForDocText } from './editor.ts';

test.describe('Real-time collaboration', () => {
  let browser1: Browser;
  let browser2: Browser;

  test.beforeAll(async () => {
    browser1 = await chromium.launch();
    browser2 = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser1.close();
    await browser2.close();
  });

  test('two users can collaborate', async () => {
    // Independent browser contexts
    const context1 = await browser1.newContext();
    const context2 = await browser2.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Both users open the application
    await page1.goto('/examples-frame/browser-yjs/');
    await page2.goto('/examples-frame/browser-yjs/');

    const editorElement1 = page1.locator('.kb-editor');
    const editorElement2 = page2.locator('.kb-editor');

    // Wait for the initial document to load, otherwise keystrokes go into
    // the empty document and are discarded when loadDocument replaces it.
    await expect(editorElement1).toContainText(
      'Playground for collaboration tests',
    );
    await expect(editorElement2).toContainText(
      'Playground for collaboration tests',
    );

    const roomId = crypto.randomUUID();
    await joinRoom(page1, roomId, { id: 'user1', name: 'User One' });
    await joinRoom(page2, roomId, { id: 'user2', name: 'User Two' });

    // Wait until the room document has settled on both sides.
    await waitForDocsEqual(
      [page1, page2],
      'Playground for collaboration tests',
    );

    // User 2 navigates and types first.
    await editorElement2.focus();
    await page2.keyboard.press('ArrowDown');
    await page2.keyboard.type('edit2');

    // Wait for user2's text to reach user1, otherwise both inserts land at
    // the same position concurrently and Yjs orders them by clientID.
    await waitForDocText(page1, 'edit2');

    // User 1 repeats the same navigation, landing before user2's text.
    await editorElement1.focus();
    await page1.keyboard.press('ArrowDown');
    await page1.keyboard.type('edit1');

    await waitForDocText(page1, 'edit1edit2');
    await waitForDocText(page2, 'edit1edit2');

    await context1.close();
    await context2.close();
  });
});
