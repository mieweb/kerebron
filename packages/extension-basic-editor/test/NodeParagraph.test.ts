import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('NodeParagraph should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test setParagraph command
  editor.chain().setParagraph().run();
});
