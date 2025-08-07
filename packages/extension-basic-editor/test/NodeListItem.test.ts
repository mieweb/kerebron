import { NodeListItem } from '../src/NodeListItem.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeListItem should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeListItem()],
  });

  // Test splitListItem command
  editor.chain().splitListItem().run();
  // Test liftListItem command
  editor.chain().liftListItem().run();
  // Test sinkListItem command
  editor.chain().sinkListItem().run();
});
