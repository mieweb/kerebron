import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('NodeListItem should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test splitListItem command
  editor.chain().splitListItem().run();
  // Test liftListItem command
  editor.chain().liftListItem().run();
  // Test sinkListItem command
  editor.chain().sinkListItem().run();
});
