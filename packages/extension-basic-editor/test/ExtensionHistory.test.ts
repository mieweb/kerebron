import { CoreEditor } from '@kerebron/editor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { BasicEditorKit } from '../src/BasicEditorKit.ts';
import { AnyExtensionOrReq } from '../../editor/src/types.ts';

Deno.test('ExtensionHistory should handle commands', () => {
  const editor = CoreEditor.create({
    editorKits: [
      new BasicEditorKit(),
      {
        getExtensions(): AnyExtensionOrReq[] {
          return [
            new ExtensionHistory(),
          ];
        },
      },
    ],
  });

  // Test undo command
  editor.chain().undo().run();
  // Test redo command
  editor.chain().redo().run();
});
