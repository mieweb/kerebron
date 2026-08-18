import { assertEquals } from '@kerebron/test-utils';
import { FileTelemetry } from '@kerebron/test-utils/FileTelemetry';

import { assetLoad } from '@kerebron/wasm/deno';
import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/markdown-it.md'),
);

if (false) { // TODO enable
  Deno.test('markdown-it', async () => {
    const editor = CoreEditor.create({
      assetLoad,
      editorKits: [
        new BrowserLessEditorKit(),
      ],
    });

    const telemetry = new FileTelemetry('markdown-it');
    telemetry.map[__dirname + '/markdown-it.md2pm.tokens.debug.json'] = [
      'md2pm',
      'tokens',
    ];
    telemetry.map[__dirname + '/markdown-it.md2pm.origDocument.debug.json'] = [
      'md2pm',
      'origDocument',
    ];

    telemetry.map[__dirname + '/markdown-it.pm2md.tokens.debug.json'] = [
      'pm2md',
      'tokens',
    ];

    telemetry.map[__dirname + '/markdown-it.tree.debug.json'] = ['tree'];

    editor.ci.register('telemetry', telemetry);

    await editor.loadDocumentText('text/x-markdown', sampleMarkdown);

    const serializedMarkdown = new TextDecoder().decode(
      await editor.saveDocument('text/x-markdown'),
    );

    Deno.writeTextFileSync(
      __dirname + '/markdown-it.result.md',
      serializedMarkdown,
    );

    assertEquals(serializedMarkdown, sampleMarkdown);
  });
}
