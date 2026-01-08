import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';

Deno.test('NodeHeading should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [new BasicEditorKit()],
  });

  // Test setHeading commands
  for (let i = 1; i <= 6; i++) {
    editor.chain()['setHeading' + i]().run();
  }
});
