import { expect, test } from '@playwright/test';

test.describe('Code block navigation', () => {
  test('should keep DOM caret and ProseMirror selection in sync while navigating', async ({ page }) => {
    await page.goto('/examples-frame/browser-lsp/');
    const editor = page.locator('.kb-editor');
    await expect(editor).toContainText('Javascript lsp test');
    // Let the initial workspace snapshot and LSP diagnostics settle.
    await expect(page.locator('.kb-lsp__error')).toHaveCount(1, {
      timeout: 15_000,
    });

    const codeBlock = page.locator('.codecrock[contenteditable]').first();
    await codeBlock.click();
    await page.keyboard.press('Home');

    const read = () =>
      page.evaluate(() => {
        const editor = (document.querySelector('.kb-component') as any)
          .editor;
        const el = document.querySelector('.codecrock[contenteditable]');
        const sel = window.getSelection();
        const rr = sel?.getRangeAt(0);
        let dom = -1;
        if (el && rr && el.contains(rr.endContainer)) {
          const r = document.createRange();
          r.selectNodeContents(el);
          r.setEnd(rr.endContainer, rr.endOffset);
          dom = r.toString().length;
        }
        return {
          pm: editor.state.selection.from,
          dom,
          codeStart: (() => {
            let start = -1;
            editor.state.doc.descendants((node: any, pos: number) => {
              if (start < 0 && node.type.name === 'code_block') {
                start = pos + 1;
              }
              return true;
            });
            return start;
          })(),
        };
      });

    // Navigate through the code block: right along the first row,
    // down into the second row, up back, end/home, left, and out of
    // the block (ArrowDown on the last row escapes to the next node).
    const keys = [
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowDown',
      'ArrowUp',
      'End',
      'Home',
      'ArrowLeft',
    ];

    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
      const s = await read();
      // While the caret is inside the code block, the ProseMirror
      // selection must map to the same raw text offset as the DOM caret.
      if (s.dom >= 0) {
        expect(s.pm, `after ${key}`).toBe(s.dom + s.codeStart);
      }
    }

    // Typing after navigation must land at the caret in both DOM and doc.
    // Place the caret deterministically: start of the current line + 2.
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const before = await read();
    expect(before.dom).toBeGreaterThanOrEqual(0);

    await page.keyboard.type('Q');
    await page.waitForTimeout(300);
    const typed = await page.evaluate((raw: number) => {
      const editor = (document.querySelector('.kb-component') as any)
        .editor;
      const el = document.querySelector('.codecrock[contenteditable]');
      let codeText: string | undefined;
      let codeStart = -1;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (codeStart < 0 && node.type.name === 'code_block') {
          codeStart = pos + 1;
          codeText = node.textContent;
        }
        return true;
      });
      return {
        domText: el?.textContent ?? '',
        pmText: codeText ?? '',
        pmQ: codeText?.slice(raw, raw + 1),
        codeStart,
      };
    }, before.dom);
    // The typed char must be at the same raw offset in DOM and document.
    expect(typed.pmQ).toBe('Q');
    expect(typed.domText.slice(before.dom, before.dom + 1)).toBe('Q');
    expect(typed.domText).toBe(typed.pmText);
  });
});
