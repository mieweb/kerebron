import { NodeHorizontalRule } from '../src/NodeHorizontalRule.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeHorizontalRule should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeHorizontalRule()],
  });

  // Test setHorizontalRule command
  editor.chain().setHorizontalRule().run();
});
