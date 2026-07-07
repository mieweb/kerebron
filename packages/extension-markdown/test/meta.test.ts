import { assertEquals } from '@kerebron/test-utils';

import { assetLoad } from '@kerebron/wasm/deno';
import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/meta.md'),
);

Deno.test('md test 4', async () => {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const source = Deno.readFileSync(__dirname + '/meta.md');
  '**strong** and *italic* __underline__';
  await editor.loadDocument('text/x-markdown', source);

  const serializedMarkdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(
    __dirname + '/meta.result.md',
    serializedMarkdown,
  );

  assertEquals(serializedMarkdown, sampleMarkdown);

  {
    const meta = await new Promise<any>((r) => editor.chain().getMeta(r).run());
    assertEquals(meta.get('title'), 'test title');
    meta.set('title', 'modified title');
    editor.chain().setMeta(meta).run();

    await new Promise((r) => setTimeout(r, 100));
  }

  {
    const meta = await new Promise<any>((r) => editor.chain().getMeta(r).run());
    assertEquals(meta.get('title'), 'modified title');

    editor.chain().updateMeta((meta: any) => {
      meta.set('title', 'modified again');
      return meta;
    }).run();
  }

  {
    const meta = await new Promise<any>((r) => editor.chain().getMeta(r).run());
    assertEquals(meta.get('title'), 'modified again');
  }

  {
    const serializedMarkdown = new TextDecoder().decode(
      await editor.saveDocument('text/x-markdown'),
    );
    assertEquals(
      serializedMarkdown,
      sampleMarkdown.replace('test title', 'modified again'),
    );
  }
});
