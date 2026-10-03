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

Deno.test('marks markdown cannot express round-trip losslessly', async () => {
  const cases: Array<[string, string, string, Record<string, string>?]> = [
    ['a ~b\\ c~ d\n', 'b c', 'subscript'],
    ['a ^b\\ c^ d\n', 'b c', 'superscript'],
    [
      'a <mark style="background-color: red;">x</mark> b\n',
      'x',
      'highlight',
      { color: 'red' },
    ],
    [
      'a <span style="color: blue;">y</span> b\n',
      'y',
      'textColor',
      { color: 'blue' },
    ],
  ];

  for (const [source, text, markType, attrs] of cases) {
    const editor = CoreEditor.create({
      assetLoad,
      editorKits: [new BrowserLessEditorKit()],
    });
    await editor.loadDocumentText('text/x-markdown', source);

    const mark = editor.getJSON().content![0].content!
      .find((item) => item.text === text)?.marks
      ?.find((m) => m.type === markType);
    assert(mark, `No ${markType} on "${text}" in ${source}`);
    if (attrs) {
      assertEquals(mark.attrs, attrs);
    }

    const output = new TextDecoder().decode(
      await editor.saveDocument('text/x-markdown'),
    );
    assertEquals(output, source);
  }
});
