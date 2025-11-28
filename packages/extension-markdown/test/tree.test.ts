import { createParser } from '$deno_tree_sitter/main.js';
import type { Parser } from '$deno_tree_sitter/tree_sitter/parser.ts';
import type { Tree } from '$deno_tree_sitter/tree_sitter/tree.ts';

import { assertEquals } from '@kerebron/test-utils';
import { MarkdownSerializer } from '@kerebron/extension-markdown/MarkdownSerializer';
import { fetchWasm, getLangTreeSitter } from '@kerebron/wasm';

import { sitterTokenizer } from '../src/treeSitterTokenizer.ts';

const __dirname = import.meta.dirname;
const source = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/tree.md'),
);

Deno.test('tree test', async () => {
  const jsonManifest = getLangTreeSitter('markdown', '');
  const blockUrl: string = jsonManifest.files.find((url) =>
    url.indexOf('_inline') === -1
  )!;
  const inlineUrl: string = jsonManifest.files.find((url) =>
    url.indexOf('_inline') > -1
  )!;

  const markdownWasm = await fetchWasm(blockUrl);
  const inlineWasm = await fetchWasm(inlineUrl);

  const blockParser: Parser =
    (await createParser(markdownWasm)) as unknown as Parser;
  const inlineParser: Parser =
    (await createParser(inlineWasm)) as unknown as Parser;

  const tree: Tree | null = blockParser.parse(source);

  Deno.writeTextFileSync(
    __dirname + '/tree.json',
    JSON.stringify(tree?.rootNode, null, 2),
  );

  const tokenizer = await sitterTokenizer();
  const tokens = tokenizer.parse(source);

  Deno.writeTextFileSync(
    __dirname + '/tree.tokens.json',
    JSON.stringify(tokens, null, 2),
  );

  const serializer = new MarkdownSerializer();
  const output = await serializer.serialize(tokens);
  const serializedMarkdown = output.toString();

  Deno.writeTextFileSync(
    __dirname + '/tree.result.md',
    serializedMarkdown,
  );

  // console.log(serializedMarkdown);
  // console.log(tree?.rootNode);
});
