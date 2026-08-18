import { assetLoad } from '@kerebron/wasm/deno';

import { StackableMarkdownParser } from '../src/StackableMarkdownParser.ts';
import { assertEquals } from '@kerebron/test-utils';

const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/StackableMarkdownParser.md'),
);

Deno.test('3-in-1 parser', async () => {
  const parser = await StackableMarkdownParser.create(assetLoad);
  const [root] = parser.parse(sampleMarkdown)!;

  const json = root.toJSON();
  assertEquals(JSON.stringify(json).includes('"type":"html"'), true);
  // console.log(JSON.stringify(json, null, 2));
  // <strong class=\"test\">html</strong>
});
