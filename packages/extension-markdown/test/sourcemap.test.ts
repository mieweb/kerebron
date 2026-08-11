// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser } from 'linkedom';
import { XMLSerializer } from '@xmldom/xmldom';

import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '@kerebron/extension-basic-editor/BasicEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { assetLoad } from '@kerebron/wasm/deno';
import { FileTelemetry } from '@kerebron/test-utils/FileTelemetry';

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
  });

  const editor = CoreEditor.create({
    assetLoad: assetLoad,
    editorKits: [
      new BasicEditorKit(),
      {
        getExtensions() {
          return [
            new ExtensionTables(),
            markdownExtension,
          ];
        },
      },
    ],
  });

  await editor.loadDocument(
    'text/x-markdown',
    new TextEncoder().encode(sampleMarkdown),
  );

  const telemetry = new FileTelemetry('sourcemap');
  telemetry.map[__dirname + '/sourcemap.pm2md.debug.tokens.json'] = [
    'pm2md',
    'tokens',
  ];
  telemetry.map[__dirname + '/sourcemap.pm2md.debug.sourcemap.json'] = [
    'pm2md',
    'sourcemap',
  ];
  editor.ci.register('telemetry', telemetry);

  const markdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(__dirname + '/sourcemap.result.md', markdown);
  // assertEquals(markdown, sampleMarkdown);
});
