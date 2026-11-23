import { expect, test } from '@playwright/test';

// Regression test for the NodeViewCodeCrock update() guard: while a code
// block is focused, an external document change (collaborative edit or
// programmatic replacement) must still sync the CodeCrock DOM. Otherwise
// the next keyup dispatches stale DOM text through valueChanged and
// overwrites the external change. Only IME composition may skip syncing.
test.describe('CodeCrock external update while focused', () => {
  test('should sync DOM on external doc change and not overwrite it on next keystroke', async ({ page }) => {
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

    // External, programmatic document change: replace the whole code
    // block content while the block keeps DOM focus.
    const externalText = 'external change 42';
    const replaced = await page.evaluate((text: string) => {
      const editor = (document.querySelector('.kb-component') as any)
        .editor;
      let codeStart = -1;
      let codeEnd = -1;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (codeStart < 0 && node.type.name === 'code_block') {
          codeStart = pos + 1;
          codeEnd = pos + node.nodeSize - 1;
        }
        return true;
      });
      if (codeStart < 0) return false;
      const tr = editor.state.tr.replaceWith(
        codeStart,
        codeEnd,
        editor.state.schema.text(text),
      );
      editor.view.dispatch(tr);
      return true;
    }, externalText);
    expect(replaced).toBe(true);

    // Give the NodeView update() a moment to run through the dispatched
    // transaction, then check that the still-focused DOM was synced.
    await page.waitForTimeout(300);
    const synced = await page.evaluate(() => {
      const el = document.querySelector('.codecrock[contenteditable]');
      return {
        focused: document.activeElement === el,
        domText: el?.textContent ?? '',
      };
    });
    expect(synced.focused).toBe(true);
    expect(synced.domText).toBe(externalText);

    // The next keystroke must build on the external text, not resurrect
    // the stale pre-change DOM content via valueChanged.
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const editor = (document.querySelector('.kb-component') as any)
        .editor;
      const el = document.querySelector('.codecrock[contenteditable]');
      let pmText: string | undefined;
      editor.state.doc.descendants((node: any) => {
        if (pmText === undefined && node.type.name === 'code_block') {
          pmText = node.textContent;
        }
        return true;
      });
      return { domText: el?.textContent ?? '', pmText: pmText ?? '' };
    });
    expect(after.domText).toBe(externalText + '!');
    expect(after.pmText).toBe(externalText + '!');
  });
});
