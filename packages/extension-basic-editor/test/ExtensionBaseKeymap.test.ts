import { ExtensionBaseKeymap } from '../src/ExtensionBaseKeymap.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('ExtensionBaseKeymap should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBaseKeymap()],
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
  const baseKeymap = editor.extensionManager.getExtension('base-keymap');
  if (baseKeymap) {
    Object.keys(baseKeymap.options.baseKeymap).forEach((key) => {
      editor.chain()[baseKeymap.name + '_' + key]().run();
    });
  }
});
