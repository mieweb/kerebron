import { NodeHeading } from '../src/NodeHeading.ts';
import { CoreEditor } from '@kerebron/editor';

Deno.test('NodeHeading should handle commands', () => {
  const editor = new CoreEditor({
    extensions: [new NodeHeading()],
  });

  // Test setHeading commands
  for (let i = 1; i <= 6; i++) {
    editor.chain()['setHeading' + i]().run();
  }
});
