/**
 * Compatibility shim for deno_tree_sitter Language -> web-tree-sitter
 */
import Parser from 'web-tree-sitter';

export const Language = Parser.Language;
export type Language = Parser.Language;
