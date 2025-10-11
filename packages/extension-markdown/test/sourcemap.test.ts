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
  const markdownExtension = new ExtensionMarkdown({
    sourceMap: true,
    debugTokens: true,
  });

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
    'md:tokens',
    ((event: CustomEvent) => {
      const { tokens } = event.detail;
      // console.log(tokens.slice(0, 5));
    }) as EventListener,
  );

  editor.addEventListener(
    'md:sourcemap',
    ((event: CustomEvent) => {
      const { sourceMap, debugMap, markdownMap } = event.detail;
      sourceMap.file = 'markdown-it.result.md';
      // sourceMap.sources = ['debug.txt'];
      // sourceMap.sourcesContent = [debugOutput.toString()];

      console.log('pos|debug|markdown');
      for (let lineNo = 0; lineNo < 32; lineNo++) {
        console.log(lineNo, debugMap[lineNo], markdownMap[lineNo]);
      }

      // console.log(markdownMap);

      Deno.writeTextFileSync(
        __dirname + '/markdown-it.result.json',
        JSON.stringify(sourceMap, null, 2),
      );
    }) as EventListener,
  );
  //
  const markdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(__dirname + '/markdown-it.result.md', markdown);
  assertEquals(markdown, sampleMarkdown);
});
