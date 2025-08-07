import { NodeHardBreak } from '../src/NodeHardBreak.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeHardBreak should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeHardBreak()],
  });

  // Test setHardBreak command
  editor.chain().setHardBreak().run();
});
