import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeHorizontalRule should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test setHorizontalRule command
  editor.chain().setHorizontalRule().run();
});
