import type * as lsp from 'vscode-languageserver-protocol';
import { Text } from '@codemirror/state';

export function toPosition(doc: Text, pos: number): lsp.Position {
  let line = doc.lineAt(pos);
  return { line: line.number - 1, character: pos - line.from };
}

export function fromPosition(doc: Text, pos: lsp.Position): number {
  let line = doc.line(pos.line + 1);
  return line.from + pos.character;
}
