/**
 * Compatibility shim for deno_tree_sitter Tree type -> web-tree-sitter
 */
import type Parser from 'web-tree-sitter';

export type Tree = Parser.Tree;
