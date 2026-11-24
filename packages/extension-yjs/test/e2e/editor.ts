import { expect, type Page } from '@playwright/test';

/**
 * The document text of the editor on the page.
 *
 * Read from the ProseMirror state instead of the DOM, because remote cursor
 * decorations render labels (e.g. the other user's name) inside the text
 * and would break substring matching.
 */
export function getDocText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const editor = (document.querySelector('.kb-component') as any).editor;
    return editor.state.doc.textContent as string;
  });
}

/**
 * Wait until the document on the page contains `text`.
 */
export async function waitForDocText(
  page: Page,
  text: string,
  timeout = 15_000,
) {
  await expect.poll(() => getDocText(page), { timeout }).toContain(text);
}

/**
 * Wait until both pages show the same settled document containing `text`.
 *
 * changeRoom swaps in the Yjs room document asynchronously, so carets must
 * not be placed before the room content has settled on both sides.
 */
export async function waitForDocsEqual(
  pages: Page[],
  text: string,
  timeout = 15_000,
) {
  await expect
    .poll(
      async () => {
        const texts = await Promise.all(pages.map(getDocText));
        return texts.every((t) => t === texts[0]) && texts[0].includes(text)
          ? texts[0]
          : '';
      },
      { timeout },
    )
    .toContain(text);
}

// The editor instance is exposed on the wrapper element (.kb-component),
// but a Playwright Locator cannot access DOM element properties directly,
// so the commands must be invoked inside page.evaluate().
export async function joinRoom(
  page: Page,
  roomId: string,
  user: { id: string; name: string },
) {
  return page.evaluate(([roomId, user]) => {
    const editor = (document.querySelector('.kb-component') as any)
      .editor;
    editor.chain().changeRoom(roomId).changeUser(user).run();
  }, [roomId, user]);
}
