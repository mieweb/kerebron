import { assertEquals } from '@kerebron/test-utils';

import { assetLoad } from '@kerebron/wasm/deno';
import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

Deno.test('md test 4', async () => {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const source = new TextEncoder().encode(
    '<div><h1>aaa</h1><span>aaa</span></div>',
  );
  await editor.loadDocument('text/html', source);

  // assertEquals(serializedMarkdown, sampleMarkdown);
});
