import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeParagraph should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test setParagraph command
  editor.chain().setParagraph().run();
});
