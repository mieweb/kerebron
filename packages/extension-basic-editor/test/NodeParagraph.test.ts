import { NodeParagraph } from '../src/NodeParagraph.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeParagraph should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeParagraph()],
  });

  // Test setParagraph command
  editor.chain().setParagraph().run();
});
