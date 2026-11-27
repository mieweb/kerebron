import * as lsp from 'vscode-languageserver-protocol';

import type { TextRange } from '@kerebron/editor';
import type { ContentMapper } from '@kerebron/workspace';

/**
 * Expand a LSP completion insert text into plain text.
 *
 * Non-snippet text (`insertTextFormat` absent or `PlainText`) is returned
 * unchanged. Snippet text (`insertTextFormat: Snippet`) gets its tabstop and
 * placeholder syntax resolved, since the editor has no interactive snippet
 * session support:
 *
 * - `$0` (final cursor position) is dropped
 * - `$1`, `${1}` are replaced with an empty string
 * - `${1:placeholder}` is replaced with the placeholder text
 * - `\$` is unescaped to a literal `$`
 * - anything else (e.g. `$name` variables) is kept as-is
 */
/**
 * Resolve the replacement range of a completion item: the item's own
 * `textEdit` range, else the completion list's `itemDefaults.editRange`.
 * Handles `InsertReplaceEdit` shapes (`insert`/`replace`) by preferring
 * `insert`. Returns undefined when no range is supplied (caller should fall
 * back to inserting at the cursor).
 */
export function itemTextEditRange(
  item: lsp.CompletionItem,
  itemDefaults: lsp.CompletionList['itemDefaults'],
): lsp.Range | undefined {
  if (item.textEdit) {
    return editRange(item.textEdit);
  }
  if (itemDefaults?.editRange) {
    return editRange(itemDefaults.editRange);
  }
  return undefined;
}

function editRange(
  edit:
    | lsp.TextEdit
    | lsp.InsertReplaceEdit
    | lsp.Range
    | { insert: lsp.Range; replace: lsp.Range },
): lsp.Range | undefined {
  if ('range' in edit) return edit.range;
  if ('start' in edit && 'end' in edit) return edit;
  if ('insert' in edit) return edit.insert;
  if ('replace' in edit) return (edit as lsp.InsertReplaceEdit).replace;
  return undefined;
}

/**
 * Map a server-supplied edit range to absolute document positions.
 *
 * `base` is the absolute document position the mapper's coordinate space is
 * anchored at: the start of an embedded block's content (`pos - parentOffset`)
 * for block-relative mappers, or 0 for a whole-document mapper whose
 * `fromLineChar` already returns absolute positions.
 */
export function editRangeToTextRange(
  editRange: lsp.Range,
  base: number,
  contentMapper: ContentMapper,
  fallback: TextRange,
): TextRange {
  const from = contentMapper.fromLineChar(
    editRange.start.line,
    editRange.start.character,
  );
  const to = contentMapper.fromLineChar(
    editRange.end.line,
    editRange.end.character,
  );
  if (base >= 0 && from > -1 && to > -1) {
    return { from: base + from, to: base + to };
  }
  return fallback;
}

export function expandLspSnippet(
  text: string,
  insertTextFormat: lsp.InsertTextFormat | undefined,
): string {
  if (insertTextFormat !== lsp.InsertTextFormat.Snippet) return text;

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\' && text[i + 1] === '$') {
      out += '$';
      i++;
      continue;
    }
    if (char !== '$') {
      out += char;
      continue;
    }
    if (text[i + 1] === '{') {
      const close = text.indexOf('}', i + 2);
      if (close === -1) {
        out += char;
        continue;
      }
      const body = text.slice(i + 2, close);
      const colon = body.indexOf(':');
      // `${1:placeholder}` -> placeholder, `${1}` -> empty
      out += colon > -1 ? body.slice(colon + 1) : '';
      i = close;
      continue;
    }
    const digit = text[i + 1];
    if (digit >= '0' && digit <= '9') {
      // `$1` -> empty, `$0` (cursor) -> dropped
      while (text[i + 1] >= '0' && text[i + 1] <= '9') {
        i++;
      }
      continue;
    }
    out += char;
  }
  return out;
}
