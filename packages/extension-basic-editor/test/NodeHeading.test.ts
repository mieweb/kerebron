import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('NodeHeading should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test setHeading commands
  for (let i = 1; i <= 6; i++) {
    editor.chain()['setHeading' + i]().run();
  }
});
