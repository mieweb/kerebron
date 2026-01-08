import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeHardBreak should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test setHardBreak command
  editor.chain().setHardBreak().run();
});
