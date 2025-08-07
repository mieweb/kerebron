import { NodeBlockquote } from '../src/NodeBlockquote.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeBlockquote should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeBlockquote()],
  });

  // Test toggleBlockquote command
  editor.chain().toggleBlockquote().run();
});
