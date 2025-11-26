import { createParser } from '$deno_tree_sitter/main.js';
import { Parser } from '$deno_tree_sitter/tree_sitter/parser.js';
import { Language } from '$deno_tree_sitter/tree_sitter/language.js';

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

  async init(lang: string) {
    const treeSitterConfig = getLangTreeSitter(lang, this.cdnUrl);
    const wasmUrl = treeSitterConfig.files[0]; // TODO add support for split parsers like markdown
    const highlightUrl = treeSitterConfig.queries['highlights.scm'];

    try {
      const wasm = await fetchWasm(wasmUrl);

      await Parser.init();
      const Lang = await Language.load(wasm);
      this.parser = new Parser();
      this.parser.setLanguage(Lang);

      // this.parser = await createParser(wasm);
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
    if (!this.parser || !this.hightligtScm) {
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
        className: 'ts-' + name,
      });
    }

    decorator.decorationGroups['highlight'] = decorations;

    return decorator.highlight(code);
  }
}
