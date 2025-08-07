import { ExtensionHistory } from '../src/ExtensionHistory.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('ExtensionHistory should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionHistory()],
  });

  // Test undo command
  editor.chain().undo().run();
  // Test redo command
  editor.chain().redo().run();
  // Test undoInputRule command
  editor.chain().undoInputRule().run();
});
