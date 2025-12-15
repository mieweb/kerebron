import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';

Deno.test('NodeBlockquote should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
  });

  // Test toggleBlockquote command
  editor.chain().toggleBlockquote().run();
});
