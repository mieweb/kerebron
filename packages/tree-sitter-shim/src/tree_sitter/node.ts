/**
 * Compatibility shim for deno_tree_sitter Node type -> web-tree-sitter
 */
import type Parser from 'web-tree-sitter';

export type Node = Parser.SyntaxNode;
