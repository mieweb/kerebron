import { assertEquals } from '@kerebron/test-utils';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assetLoad } from '@kerebron/wasm/deno';

import { MarkdownSerializer } from '@kerebron/extension-markdown/MarkdownSerializer';
import { sitterTokenizer } from '../src/treeSitterTokenizer.ts';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/entities.md'),
);

Deno.test('entities.md', async () => {
  const tokenizer = await sitterTokenizer(assetLoad);
  const tokens = tokenizer.parse(sampleMarkdown);
  Deno.writeTextFileSync(
    __dirname + '/entities.tokens.json',
    JSON.stringify(tokens, null, 2),
  );

  const serializer = new MarkdownSerializer();
  const output = await serializer.serialize(tokens);

  const serializedMarkdown = output.toString();

  assertEquals(serializedMarkdown, sampleMarkdown);
});

Deno.test('sourcemap test', async () => {
  const editor = CoreEditor.create({
    assetLoad: assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  await editor.loadDocument(
    'text/x-markdown',
    new TextEncoder().encode(sampleMarkdown),
  );

  const outMd = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );
  const outHtml = new TextDecoder().decode(
    await editor.saveDocument('text/html'),
  );

  assertEquals(outMd.trim(), 'Copyright (c) 2026');
  assertEquals(outHtml.trim(), '<p>Copyright © 2026</p>');
});
