import { expect, Page, test } from '@playwright/test';
import { clearEditor } from './editor.ts';

function caretRowCol(page: Page): Promise<[number, number] | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    const sel = document.getSelection()!;
    if (!el || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    const before = pre.toString().replace(/\u200B/g, '');
    const lines = before.split('\n');
    return [lines.length - 1, lines[lines.length - 1].length];
  });
}

test.describe('Code editing', () => {
  test('should enter code text', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');

    await page.keyboard.press('ArrowUp');

    const codeBlock = page.locator('.codecrock').last();
    await expect(codeBlock).toBeVisible();

    // Firefox legacy mode and the Chromium newline normalization insert a
    // zero-width space after a trailing newline - strip it before comparing.
    const content = await codeBlock.evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );

    const expected = 'console.log();\nconsole.log();\nconsole.log();\n```\n';
    expect(content).toBe(expected);
  });

  test('should prepend codeblock', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    // Shift+Enter prepends a paragraph above the code block only when the
    // caret is at the very beginning of the block
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+Enter');

    // Simulate real-user timing: let the debounced (500ms) selectionchange
    // and highlight handlers run before typing the heading
    await page.waitForTimeout(700);

    await page.keyboard.type('# Doc title');

    // A heading is created above the code block, the code block is untouched
    await expect(page.locator('.kb-editor h1', { hasText: 'Doc title' }))
      .toBeVisible();
    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('console.log();');
  });

  test('should append codeblock', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    // Caret at the end of the (last) line: Shift+Enter appends a paragraph
    // below the code block
    await page.keyboard.press('Shift+Enter');

    // Simulate real-user timing: let the debounced (500ms) selectionchange
    // and highlight handlers run before typing the footer
    await page.waitForTimeout(700);
    await page.keyboard.type('Doc footer');

    // A paragraph is created below the code block, the code block is untouched
    const footer = page.locator('.codecrock-root ~ p', {
      hasText: 'Doc footer',
    });
    await expect(footer).toBeVisible();
    await expect(footer).toHaveText('Doc footer');

    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('console.log();');
  });

  test('should append codeblock from last line of multiline code', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('return 42;');
    // Caret on the last, non-first line: Shift+Enter still appends a
    // paragraph below the code block
    await page.keyboard.press('Shift+Enter');

    // Simulate real-user timing: let the debounced (500ms) selectionchange
    // and highlight handlers run before typing the footer
    await page.waitForTimeout(700);
    await page.keyboard.type('Doc footer');

    // A paragraph is created below the code block, the code block is untouched
    const footer = page.locator('.codecrock-root ~ p', {
      hasText: 'Doc footer',
    });
    await expect(footer).toBeVisible();
    await expect(footer).toHaveText('Doc footer');

    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('console.log();\nreturn 42;');
  });

  test('should navigate with arrows', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log();');

    // Let the debounced (500ms) highlight and selectionchange handlers run
    // before navigating - same as a real user pausing after typing.
    await page.waitForTimeout(700);

    // Document layout (0-based): three 'console.log();' lines followed by
    // an empty line. The caret starts at the end of line 3 (row 2).
    expect(await caretRowCol(page)).toEqual([2, 14]);

    await page.keyboard.press('ArrowUp');
    expect(await caretRowCol(page)).toEqual([1, 14]); // end of line 2

    await page.keyboard.press('ArrowUp');
    expect(await caretRowCol(page)).toEqual([0, 14]); // end of line 1

    await page.keyboard.press('ArrowLeft');
    expect(await caretRowCol(page)).toEqual([0, 13]); // line 1, before ';'

    await page.keyboard.press('ArrowDown');
    expect(await caretRowCol(page)).toEqual([1, 13]); // line 2, before ';'

    await page.keyboard.press('ArrowDown');
    expect(await caretRowCol(page)).toEqual([2, 13]); // line 3, before ';'

    await page.keyboard.press('ArrowRight');
    expect(await caretRowCol(page)).toEqual([2, 14]); // back at the end of line 3
  });

  test('should handle arrow down', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.press('Enter');
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('12345678');

    // Simulate real-user timing: let the debounced (100ms) CodeCrock
    // onUpdate handler sync the typed text into the ProseMirror document
    // before navigating, otherwise the arrows race a stale (empty) block.
    await page.waitForTimeout(700);

    // Document layout: an empty paragraph followed by a code block with a
    // single line '12345678'. The caret is at the end of that line
    // (caretRowCol is relative to the focused code editable).
    expect(await caretRowCol(page)).toEqual([0, 8]);

    await page.keyboard.press('ArrowUp');
    // ArrowUp on the first row escapes to the empty paragraph above
    // (caretRowCol is now relative to the editor root)
    expect(await caretRowCol(page)).toEqual([0, 0]);

    await page.keyboard.press('ArrowDown');
    // ArrowDown re-enters the code block at the start of its only line
    expect(await caretRowCol(page)).toEqual([0, 0]);

    await page.keyboard.press('ArrowDown');
    // ArrowDown on the last row, with no block below, keeps the caret
    // inside the code block at the end of the line
    expect(await caretRowCol(page)).toEqual([0, 8]);

    await page.keyboard.type('9');
    // The '9' is appended at the end of the code block
    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('123456789');
  });

  test('should handle backspace at the beginning', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Backspace');

    // Backspace at the very beginning lifts the code formatting: the code
    // block is replaced by paragraphs, one per code line.
    await expect(page.locator('.codecrock')).toHaveCount(0);
    const paragraphs = page.locator('.kb-editor p');
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(0)).toHaveText('Test');
    await expect(paragraphs.nth(1)).toHaveText('Second line');
  });

  test('should backspace last character', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Known WebKit issue https://bugs.webkit.org/show_bug.cgi?id=15256',
    );

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Backspace');

    // The escape attempts (ArrowDown/ArrowRight at the end of the last
    // row) must leave the caret at the end of the code text, so Backspace
    // deletes the last character.
    await page.waitForTimeout(300);
    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('Test\nSecond lin');

    // Repeated Backspace deletes one character at a time - never the
    // whole block at once.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    const codeText2 = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText2).toBe('Test\nSecond l');
  });

  test('should not show console error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('```');
    await page.keyboard.press('Enter');

    // Fast typing races the debounced (100ms) sync of the contenteditable
    // into the ProseMirror document - forwarding the out-of-sync caret used
    // to throw "Position x out of range".
    for (let i = 0; i < 100; i++) {
      await page.keyboard.type('a');
      await page.keyboard.press('ArrowRight');
    }

    // Let the debounced (500ms) selectionchange and highlight handlers run
    await page.waitForTimeout(700);

    // The example's Yjs WebSocket connection fails intermittently during
    // the handshake, unrelated to the editor - not a console error of it.
    const editorErrors = consoleErrors.filter((message) =>
      !message.startsWith('WebSocket connection')
    );
    expect(editorErrors).toEqual([]);
  });

  test('should convert to one codeblock', async ({ page }) => {
    await page.goto('/examples-frame/browser-ui/');

    await clearEditor(page);

    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third line');

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+Shift+"');

    // The selected paragraphs are merged into a single code block, with
    // one code line per original paragraph.
    const codeBlock = page.locator('.codecrock-root');
    await expect(codeBlock).toHaveCount(1);

    const codeText = await page.locator('.codecrock').evaluate((el) =>
      (el.textContent || '').replace(/\u200B/g, '')
    );
    expect(codeText).toBe('Test\nSecond line\nThird line');
  });
});
