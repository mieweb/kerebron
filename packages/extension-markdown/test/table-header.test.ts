import { assetLoad } from '@kerebron/wasm/deno';

import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { CoreEditor } from '@kerebron/editor';
import { assertEquals } from '@kerebron/test-utils';
import { FileTelemetry } from '@kerebron/test-utils/FileTelemetry';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/table-header.md'),
);

Deno.test('table-header', async () => {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const telemetry = new FileTelemetry('table-header');
  telemetry.map[__dirname + '/table-header.md2pm.tokens.debug.json'] = [
    'md2pm',
    'tokens',
  ];
  telemetry.map[__dirname + '/table-header.md2pm.origDocument.debug.json'] = [
    'md2pm',
    'origDocument',
  ];

  telemetry.map[__dirname + '/table-header.pm2md.tokens.debug.json'] = [
    'pm2md',
    'tokens',
  ];

  telemetry.map[__dirname + '/table-header.tree.debug.json'] = ['tree'];

  editor.ci.register('telemetry', telemetry);

  const source = Deno.readFileSync(__dirname + '/table-header.md');
  await editor.loadDocument('text/x-markdown', source);

  const serializedMarkdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  Deno.writeTextFileSync(
    __dirname + '/table-header.result.md',
    serializedMarkdown,
  );

  assertEquals(serializedMarkdown, sampleMarkdown);
});
