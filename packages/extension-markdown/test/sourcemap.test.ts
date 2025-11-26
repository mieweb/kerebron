// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, parseHTML } from 'npm:linkedom@latest';
import { XMLSerializer } from 'npm:xmldom@latest';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeDocumentCode } from '@kerebron/extension-basic-editor/NodeDocumentCode';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';

globalThis.DOMParser = DOMParser as any;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;

globalThis.document = doc as any;

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/markdown-it.md'),
);

Deno.test('sourcemap test', async () => {
  const markdownExtension = new ExtensionMarkdown({
    sourceMap: true,
    debugTokens: true,
  });

  const editor = new CoreEditor({
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionTables(),
      new NodeDocumentCode({ lang: 'markdown' }),
      new NodeCodeBlock(),
      markdownExtension,
    ],
  });

  await editor.loadDocument(
    'text/x-markdown',
    new TextEncoder().encode(sampleMarkdown),
  );

  editor.addEventListener(
    'md:tokens',
    ((event: CustomEvent) => {
      const { tokens } = event.detail;
      Deno.writeTextFileSync(
        __dirname + '/sourcemap.debug.tokens.json',
        JSON.stringify(tokens, null, 2),
      );
    }) as EventListener,
  );

  editor.addEventListener(
    'md:sourcemap',
    ((event: CustomEvent) => {
      const { sourceMap, debugMap, rawTextMap } = event.detail;
      sourceMap.file = 'sourcemap.result.md';
      Deno.writeTextFileSync(
        __dirname + '/sourcemap.result.json',
        JSON.stringify(sourceMap, null, 2),
      );
    }) as EventListener,
  );

  const markdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(__dirname + '/sourcemap.result.md', markdown);
  // assertEquals(markdown, sampleMarkdown);
});
