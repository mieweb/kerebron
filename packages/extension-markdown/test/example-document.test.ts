import { assertEquals } from '@kerebron/test-utils';

import { MarkdownSerializer } from '@kerebron/extension-markdown/MarkdownSerializer';
import { sitterTokenizer } from '../src/treeSitterTokenizer.ts';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/example-document.md'),
);

Deno.test('example-document.md', async () => {
  console.log('000');
  const tokenizer = await sitterTokenizer();
  console.log('1111');
  const tokens = tokenizer.parse(sampleMarkdown);

  // Deno.writeTextFileSync(__dirname + '/example-document.tree.json', JSON.stringify(tree?.rootNode, null, 2));

  const serializer = new MarkdownSerializer();
  const output = await serializer.serialize(tokens);
  console.log('ooo', output);

  const serializedMarkdown = output.toString();

  Deno.writeTextFileSync(
    __dirname + '/example-document.tokens.json',
    JSON.stringify(tokens, null, 2),
  );

  assertEquals(serializedMarkdown, sampleMarkdown);
});
