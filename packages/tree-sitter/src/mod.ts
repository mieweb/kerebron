import { Language, Parser, Query } from 'web-tree-sitter';
export type { Language, Node, Parser, Tree } from 'web-tree-sitter';
export { Query };

await Parser.init();

export async function createParser(wasm: Uint8Array): Promise<Parser> {
  const language = await Language.load(wasm);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export async function createParserLanguage(
  wasm: Uint8Array,
): Promise<[Parser, Language]> {
  const language = await Language.load(wasm);
  const parser = new Parser();
  parser.setLanguage(language);
  return [parser, language];
}
