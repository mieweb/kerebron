import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeListItem should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test splitListItem command
  editor.chain().splitListItem().run();
  // Test liftListItem command
  editor.chain().liftListItem().run();
  // Test sinkListItem command
  editor.chain().sinkListItem().run();
});
