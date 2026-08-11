import { assertEquals } from '@kerebron/test-utils';
import { FileTelemetry } from '@kerebron/test-utils/FileTelemetry';

import { assetLoad } from '@kerebron/wasm/deno';
import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/block-macro.md'),
);

Deno.test('block-macro', async () => {
  const markdownExtension = new ExtensionMarkdown({
    sourceMap: true,
    htmlListItems: true,
  });

  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
      {
        getExtensions() {
          return [
            markdownExtension,
          ];
        },
      },
    ],
  });

  const telemetry = new FileTelemetry('block-macro');
  telemetry.map[__dirname + '/block-macro.md2pm.tokens.debug.json'] = [
    'md2pm',
    'tokens',
  ];
  telemetry.map[__dirname + '/block-macro.md2pm.origDocument.debug.json'] = [
    'md2pm',
    'origDocument',
  ];

  telemetry.map[__dirname + '/block-macro.pm2md.tokens.debug.json'] = [
    'pm2md',
    'tokens',
  ];

  telemetry.map[__dirname + '/block-macro.tree.debug.json'] = ['tree'];

  editor.ci.register('telemetry', telemetry);

  const source = Deno.readFileSync(__dirname + '/block-macro.md');
  await editor.loadDocument('text/x-markdown', source);

  const serializedMarkdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(
    __dirname + '/block-macro.result.md',
    serializedMarkdown,
  );

  assertEquals(serializedMarkdown, sampleMarkdown);
});
