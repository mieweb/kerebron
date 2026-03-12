import { assert } from '@kerebron/test-utils';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

Deno.test('inline marks test', async () => {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const source = '**strong** and *italic* __underline__';
  await editor.loadDocumentText('text/x-markdown', source);

  const json = editor.getJSON();

  assert(
    json.content![0].content!.find((item) =>
      item.text === 'strong' && item.marks!.find((m) => m.type === 'strong')
    ),
    'No strong',
  );
  assert(
    json.content![0].content!.find((item) =>
      item.text === 'italic' && item.marks!.find((m) => m.type === 'em')
    ),
    'No italic',
  );
  assert(
    json.content![0].content!.find((item) =>
      item.text === 'underline' &&
      item.marks!.find((m) => m.type === 'underline')
    ),
    'No underline',
  );
});
