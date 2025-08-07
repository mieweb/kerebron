import { NodeBulletList } from '../src/NodeBulletList.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeBulletList should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeBulletList()],
  });

  // Test toggleBulletList command
  editor.chain().toggleBulletList().run();
});
