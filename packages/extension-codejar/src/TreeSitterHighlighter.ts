import {
  createParserLanguage,
  type Language,
  type Parser,
  Query,
  type Tree,
} from '@kerebron/tree-sitter';

import {
  fetchTextResource,
  fetchWasm,
  getLangTreeSitter,
} from '@kerebron/wasm';

import { DecorationInline, Decorator } from './Decorator.ts';

export class TreeSitterHighlighter {
  parser: Parser | undefined;
  language: Language | undefined;
  hightligtScm: string | undefined;
  cdnUrl? = 'http://localhost:8000/wasm/';

  async init(lang: string) {
    const treeSitterConfig = getLangTreeSitter(lang, this.cdnUrl);
    const wasmUrl = treeSitterConfig.files[0]; // TODO add support for split parsers like markdown
    const highlightUrl = treeSitterConfig.queries['highlights.scm'];

    try {
      const wasm = await fetchWasm(wasmUrl);
      const [parser, language] = await createParserLanguage(wasm);
      this.parser = parser;
      this.language = language;

      this.hightligtScm = await fetchTextResource(highlightUrl);
    } catch (err) {
      console.error('Error init highlight for: ' + lang, err);
    }

    if (!this.parser) {
      console.warn('Parser not inited');
      return false;
    }
    if (!this.hightligtScm) {
      console.warn('hightligtScm not inited');
      return false;
    }

    return true;
  }

  highlight(code: string, decorator: Decorator) {
    return decorator.highlight(code);
    if (!this.parser || !this.language || !this.hightligtScm) {
      return decorator.highlight(code);
    }

    const tree = this.parser.parse(code)!;
    const root = tree.rootNode;

    const highlightsQuery = new Query(this.language, this.hightligtScm);
    const highlightsResult = highlightsQuery.matches(root);

    const captures = [];

    for (const item of highlightsResult) {
      console.log('item', item.captures.map((c) => c.node));
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
