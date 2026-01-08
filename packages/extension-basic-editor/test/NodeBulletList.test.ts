import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeBulletList should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test toggleBulletList command
  editor.chain().toggleBulletList().run();
});
