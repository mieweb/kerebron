import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('NodeBulletList should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test toggleBulletList command
  editor.chain().toggleBulletList().run();
});
