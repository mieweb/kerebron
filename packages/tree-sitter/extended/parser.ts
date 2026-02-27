// import { Tree } from "../web-tree-sitter/src/tree.ts"
// import { ParseOptions, Parser } from "../web-tree-sitter/src/parser.ts"
// import { Language } from "../web-tree-sitter/src/language.ts"
// import { ParseCallback } from "../web-tree-sitter/src/index.ts";
// import { setModule } from '../web-tree-sitter/src/constants.ts';
// import { MainModule } from '../web-tree-sitter/lib/web-tree-sitter.d.ts';
import './node_extended.ts';
import {
  Language,
  ParseCallback,
  ParseOptions,
  Parser,
  Tree,
} from 'web-tree-sitter';

// this only exists to help with type hints
class ExtendedParser extends Parser {
  disableSoftNodes = false;

  /**
   * Parse a slice of UTF8 text.
   *
   * @param {string | ParseCallback} callback - Source code to parse
   *
   * @param {Tree | null} [oldTree] - A previous syntax tree parsed from the same document. If the text of the
   *   document has changed since `oldTree` was created, then you must edit `oldTree` to match
   *   the new text using {@link Tree#edit}.
   *
   * @param {ParseOptions} [options] - Options for parsing the text.
   *  This can be used to set the included ranges, or a progress callback.
   *
   * @returns {ExtendedTree | null} A {@link Tree} if parsing succeeded, or `null` if:
   *  - The parser has not yet had a language assigned with {@link Parser#setLanguage}.
   *  - The progress callback returned true.
   */
  override parse(
    code: string | ParseCallback,
    oldTree: Tree | null,
    options: ParseOptions,
  ) {
    if (typeof code == 'function') {
      console.warn(
        "When calling .parse() the source code was a function instead of a string. The original tree sitter supports giving a function as a means of supporting edits (see: https://github.com/tree-sitter/tree-sitter/discussions/2553 ).\nHowever, this library supports edits directly (use node.replaceInnards(``))\nThe downside of making edits easy is that .parse() doesn't really accept a function argument. I'm just going to evaluate that function to grab the string once at the beginning. Use tree.codeString if you want to get the full string after a .replaceInnards() call.",
      );
      code = code(0, { row: 0, column: 0 }) || '';
    }
    // if (!checkModule()) {
    //   throw new Error("cannot construct a Parser before calling `init()`");
    // }

    let tree: Tree | null = null;
    tree = super.parse.apply(this, [
      (index: number) => (tree?.codeString ?? code).slice(index),
      oldTree,
      options,
    ]);

    tree.codeString = code;
    tree._enableSoftNodes = !this.disableSoftNodes;
    return tree;
  }
}

const langCache = new Map();
let hasBeenLoaded = false;
/**
 * Creates and returns a new parser instance, loading a language from a WebAssembly binary or file path.
 * Optionally, the parser can be configured to disable soft nodes.
 *
 * @async
 * @param {Uint8Array|string} wasmUint8ArrayOrFilePath - The WebAssembly binary as a `Uint8Array` or a file path to load the language.
 * @param {Object} [options] - Optional configuration options.
 * @param {boolean} [options.disableSoftNodes=false] - Whether to disable soft nodes in the parser (default is `false`).
 * @returns {Promise<ExtendedParser>} A promise that resolves to the created parser instance.
 */
interface Options {
  disableSoftNodes?: boolean;
  moduleOptions?: Object;
}

export async function createParser(
  wasmUint8Array: Uint8Array,
  { disableSoftNodes = false, moduleOptions }: Options = {},
) {
  await Parser.init();

  if (!hasBeenLoaded) {
    hasBeenLoaded = true;
    await Parser.init(moduleOptions);
  }
  const parser = new ExtendedParser();
  const language = await Language.load(wasmUint8Array);
  parser.setLanguage(language);
  parser.disableSoftNodes = disableSoftNodes;
  return parser;
}
