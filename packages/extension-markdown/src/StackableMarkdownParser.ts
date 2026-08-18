import { createParser, type Parser, type Tree } from '@kerebron/tree-sitter';
import { getLangTreeSitter } from '@kerebron/wasm';
import { AssetLoad } from '@kerebron/editor';
import { ExtendedNode, TreeSitterNodeExt } from '@kerebron/tree-sitter';

export class StackableMarkdownParser {
  private constructor(
    private blockParser: Parser,
    private inlineParser: Parser,
    private htmlParser: Parser,
  ) {
  }

  static async create(assetLoad: AssetLoad) {
    const mdManifest = getLangTreeSitter('markdown');
    const htmlManifest = getLangTreeSitter('html');
    const blockUrl: string = mdManifest.files.find((url) =>
      url.indexOf('_inline') === -1
    )!;
    const inlineUrl: string = mdManifest.files.find((url) =>
      url.indexOf('_inline') > -1
    )!;
    const htmlUrl: string = htmlManifest.files[0]!;

    const markdownWasm = await assetLoad(mdManifest.dir + '/' + blockUrl);
    const inlineWasm = await assetLoad(mdManifest.dir + '/' + inlineUrl);
    const htmlWasm = await assetLoad(htmlManifest.dir + '/' + htmlUrl);

    const blockParser: Parser =
      (await createParser(markdownWasm, { assetLoad })) as unknown as Parser;
    const inlineParser: Parser =
      (await createParser(inlineWasm, { assetLoad })) as unknown as Parser;
    const htmlParser: Parser =
      (await createParser(htmlWasm, { assetLoad })) as unknown as Parser;

    return new StackableMarkdownParser(blockParser, inlineParser, htmlParser);
  }

  parse(content: string): [ExtendedNode, Tree[]] | null {
    const tree = this.blockParser.parse(content);
    if (!tree) {
      return null;
    }

    const trees: Tree[] = [];

    const root = new ExtendedNode(tree.rootNode, content);
    trees.push(tree);

    const inlineMapper = (
      c: TreeSitterNodeExt[],
      parentNode: TreeSitterNodeExt,
    ): TreeSitterNodeExt[] => {
      return c.map((node) => {
        if (node.type !== 'inline') {
          return node;
        }

        const tree = this.inlineParser.parse(node.text);
        if (!tree) {
          return node;
        }
        trees.push(tree);

        const offsets = {
          startIndex: node.startIndex,
          startPosition: node.startPosition,
        };

        const inlineRoot = new ExtendedNode(tree.rootNode, content, offsets);

        inlineRoot.mappers.push(mergeHtml);

        return inlineRoot;
      });
    };

    root.mappers.push(inlineMapper);

    return [root, trees];
  }
}

export function mergeHtml(tokens: TreeSitterNodeExt[]): TreeSitterNodeExt[] {
  const result: TreeSitterNodeExt[] = [];

  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Only an opening HTML tag can start a chunk.
    if (token.type !== 'html_tag') {
      result.push(token);
      i++;
      continue;
    }

    const parsed = parseHtmlTag(token.text);

    if (!parsed || parsed.type !== 'open') {
      result.push(token);
      i++;
      continue;
    }

    // Try to find a valid matching HTML chunk starting here.
    const end = findMatchingHtmlChunk(tokens, i);

    if (end !== null) {
      const htmlTokens = tokens.slice(i, end + 1);
      const first = htmlTokens[0];
      const text = htmlTokens
        .map((t) => t.text)
        .join('');

      const htmlNode = new ExtendedNode({
        type: 'html',
        text,
        id: 0,
        tree: first.tree,
        startIndex: first.startIndex,
        endIndex: first.startIndex + text.length,
        startPosition: first.startPosition,
        endPosition: { // Assuming inline parser with single line
          row: first.startPosition.row,
          column: first.startPosition.column + text.length,
        },
        typeId: 0,
        children: [],
        parent: first.parent,
      }, first.treeText);

      result.push(htmlNode);

      i = end + 1;
      continue;
    }

    // This opening tag does not form a valid chunk.
    // Keep it and continue looking. This is what allows
    // nested valid HTML to be processed.
    result.push(token);
    i++;
  }

  return result;
}

function findMatchingHtmlChunk(
  tokens: TreeSitterNodeExt[],
  start: number,
): number | null {
  const stack: string[] = [];

  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type !== 'html_tag') {
      continue;
    }

    const tag = parseHtmlTag(token.text);

    if (!tag) {
      return null;
    }

    if (tag.type === 'open') {
      stack.push(tag.name);
      continue;
    }

    if (tag.type === 'self') {
      continue;
    }

    // Closing tag
    if (stack.length === 0) {
      return null;
    }

    const expected = stack[stack.length - 1];

    if (expected !== tag.name) {
      // The HTML chunk starting at `start` is invalid.
      return null;
    }

    stack.pop();

    // The original opening tag has now been closed.
    if (stack.length === 0) {
      return i;
    }
  }

  // No matching closing tag.
  return null;
}

type ParsedTag = { type: 'open'; name: string } | {
  type: 'close';
  name: string;
} | { type: 'self'; name: string };

function parseHtmlTag(text: string): ParsedTag | null {
  const closing = text.match(/^<\s*\/\s*([a-zA-Z][\w:-]*)\s*>$/);

  if (closing) {
    return {
      type: 'close',
      name: closing[1].toLowerCase(),
    };
  }

  const opening = text.match(
    /^<\s*([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>$/,
  );

  if (opening) {
    return {
      type: 'open',
      name: opening[1].toLowerCase(),
    };
  }

  const selfClosing = text.match(
    /^<\s*([a-zA-Z][\w:-]*)(?:\s[^<>]*)?\/\s*>$/,
  );

  if (selfClosing) {
    return {
      type: 'self',
      name: selfClosing[1].toLowerCase(),
    };
  }

  return null;
}
