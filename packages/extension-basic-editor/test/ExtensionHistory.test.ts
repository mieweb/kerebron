import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';

Deno.test('ExtensionHistory should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor(), new ExtensionHistory()],
  });

  // Test undo command
  editor.chain().undo().run();
  // Test redo command
  editor.chain().redo().run();
});
