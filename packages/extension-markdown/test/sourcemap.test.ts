import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';
import { assertEquals, trimLines } from '@kerebron/test-utils';

// import sampleMarkdown from './markdown-it.md' with { type: 'text' }; // --unstable-raw-imports
const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/markdown-it.md'),
);

Deno.test('sourcemap test', async () => {
  const markdownExtension = new ExtensionMarkdown({ sourceMap: true });

  const editor = new CoreEditor({
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionTables(),
      new NodeCodeMirror(),
      markdownExtension,
    ],
  });

  await editor.loadDocument(
    'text/x-markdown',
    new TextEncoder().encode(sampleMarkdown),
  );

  editor.addEventListener(
    'md:sourcemap',
    ((event: CustomEvent) => {
      const { sourceMap, debugMap, markdownMap } = event.detail;
      sourceMap.file = 'sm-test.md';
      // sourceMap.sources = ['debug.txt'];
      // sourceMap.sourcesContent = [debugOutput.toString()];

      for (let lineNo = 0; lineNo < 240; lineNo++) {
        console.log(lineNo, debugMap[lineNo], markdownMap[lineNo]);
      }
    }) as EventListener,
  );
  //
  const markdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );
  assertEquals(markdown, sampleMarkdown);
});
