import { createParser, type Parser } from '@kerebron/tree-sitter';

import {
  fetchTextResource,
  fetchWasm,
  getLangTreeSitter,
} from '@kerebron/wasm';

import { DecorationInline, Decorator } from './Decorator.ts';

export class TreeSitterHighlighter {
  parser: Parser | undefined;
  hightligtScm: string | undefined;
  cdnUrl? = 'http://localhost:8000/wasm/';
  lang?: string;

  async init(lang: string): Promise<boolean> {
    this.lang = lang;
    if (!lang) {
      this.parser = undefined;
      this.hightligtScm = undefined;
      return true;
    }
    const treeSitterConfig = getLangTreeSitter(lang, this.cdnUrl);
    const wasmUrl = treeSitterConfig.files[0]; // TODO add support for split parsers like markdown
    const highlightUrl = treeSitterConfig.queries['highlights.scm'];

    try {
      const wasm = await fetchWasm(wasmUrl);
      this.parser = await createParser(wasm);

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
    if (!this.lang || !this.parser || !this.hightligtScm) {
      decorator.decorationGroups['highlight'] = [];
      return decorator.highlight(code);
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
        className: 'ts-' + name.replaceAll('.', '_'),
      });
    }

    decorator.decorationGroups['highlight'] = decorations;

    return decorator.highlight(code);
  }
}
