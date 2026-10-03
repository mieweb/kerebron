/** Renders Markdown through Kerebron the way an editor load/save does. */
import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

const decoder = new TextDecoder();

export async function kerebron(md: string) {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [new BrowserLessEditorKit()],
  });
  await editor.loadDocumentText('text/x-markdown', md);
  return {
    html: decoder.decode(await editor.saveDocument('text/html')),
    saved: decoder.decode(await editor.saveDocument('text/x-markdown')).trim(),
  };
}

// Kerebron logs unsupported nodes/marks; reports already show them.
export async function quietly<T>(run: () => Promise<T>): Promise<T> {
  const { debug, warn } = console;
  console.debug = console.warn = () => {};
  try {
    return await run();
  } finally {
    Object.assign(console, { debug, warn });
  }
}
