import { assert } from '@kerebron/test-utils';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/hr-issue.md'),
);

Deno.test({
  name: 'hr issue test',
  fn: async () => {
    const editor = CoreEditor.create({
      assetLoad: assetLoad,
      editorKits: [
        new BrowserLessEditorKit(),
      ],
    });

    await editor.loadDocumentText('text/x-markdown', sampleMarkdown);
    const json = editor.getJSON();

    assert(
      json.content![1].content!.find((item) => item.type === 'hr'),
      'No hr',
    );
  },
});
