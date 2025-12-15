import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('ExtensionBaseKeymap should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test joinUp command
  editor.chain().joinUp().run();
  // Test joinDown command
  editor.chain().joinDown().run();
  // Test lift command
  editor.chain().lift().run();
  // Test selectParentNode command
  editor.chain().selectParentNode().run();
  // Test selectNodeBackward command
  editor.chain().selectNodeBackward().run();
  // Test selectNodeForward command
  editor.chain().selectNodeForward().run();
  // Test commands for each key in baseKeymap
  const baseKeymap = editor.getExtension('base-keymap');
  if (baseKeymap) {
    Object.values(baseKeymap.getKeyboardShortcuts()).forEach(
      (action?: string) => {
        if (!action) {
          return;
        }
        editor.chain()[action]().run();
      },
    );
  }
});
