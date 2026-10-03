import { assert, assertEquals } from '@kerebron/test-utils';

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

Deno.test('pandoc-style inline marks round-trip', async () => {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const source = 'H~2~O, 2^10^, ==marked== and ~~struck~~\n';
  await editor.loadDocumentText('text/x-markdown', source);

  const items = editor.getJSON().content![0].content!;
  const hasMark = (text: string, mark: string) =>
    items.find((item) =>
      item.text === text && item.marks?.find((m) => m.type === mark)
    );
  assert(hasMark('2', 'subscript'), 'No subscript');
  assert(hasMark('10', 'superscript'), 'No superscript');
  assert(hasMark('marked', 'highlight'), 'No highlight');
  assert(hasMark('struck', 'strike'), 'No strike');

  const output = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );
  assertEquals(output, source);
});
