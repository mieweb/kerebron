import { createParser } from '$deno_tree_sitter/main.js';
import { Parser } from '$deno_tree_sitter/tree_sitter/parser.js';
import type { Tree } from '$deno_tree_sitter/tree_sitter/tree.js';

import { getLangTreeSitter } from '@kerebron/wasm';

import { DecorationInline, Decorator } from './Decorator.ts';

export class TreeSitterHighlighter {
  parser: Parser | undefined;
  hightligtScm: string | undefined;
  cdnUrl = 'http://localhost:8000/wasm/';

  async init(lang: string) {
    const treeSitterConfig = getLangTreeSitter(lang, this.cdnUrl);
    const wasmUrl = treeSitterConfig.files[0]; // TODO add support for split parsers like markdown
    const highlightUrl = treeSitterConfig.queries['highlights.scm'];

    const response = await fetch(wasmUrl);
    if (response.status >= 400) {
      throw new Error(`Error fetching ${response.status}`);
    }

    const wasm = new Uint8Array(await response.arrayBuffer());

    this.parser = await createParser(wasm);

    const responseScm = await fetch(highlightUrl);
    if (responseScm.status >= 400) {
      throw new Error(`Error fetching ${responseScm.status}`);
    }

    this.hightligtScm = await responseScm.text();
  }

  highlight(code: string, decorator: Decorator) {
    if (!this.parser) {
      throw new Error('Parser not inited');
    }
    if (!this.hightligtScm) {
      throw new Error('hightligtScm not inited');
    }

    const tree = this.parser.parse(code)!;
    const root = tree.rootNode;

    const highlightsQuery = root.query(this.hightligtScm);

    const captures = [];

    for (const item of highlightsQuery) {
      captures.push(...item.captures);
    }

    const decorations: DecorationInline[] = [];

    for (const capture of captures) {
      const { node, name } = capture; // name is the capture like "@string"

      const startIndex = node.startIndex;
      const endIndex = node.endIndex;

      decorations.push({
        startIndex,
        endIndex,
        className: 'ts-' + name,
      });
    }

    decorator.decorationGroups['highlight'] = decorations;

    return decorator.highlight(code);
  }
}
