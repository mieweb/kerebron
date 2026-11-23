import { assertEquals } from '@std/assert';
import * as lsp from 'vscode-languageserver-protocol';

import { expandLspSnippet, itemTextEditRange } from '../src/snippets.ts';

Deno.test('expandLspSnippet: plain text unchanged', () => {
  const text = 'console.log($args)';
  assertEquals(expandLspSnippet(text, undefined), text);
  assertEquals(
    expandLspSnippet(text, lsp.InsertTextFormat.PlainText),
    text,
  );
});

Deno.test('expandLspSnippet: code block snippet', () => {
  assertEquals(
    expandLspSnippet(
      '```language\n$0\n```',
      lsp.InsertTextFormat.Snippet,
    ),
    '```language\n\n```',
  );
});

Deno.test('expandLspSnippet: tabstops and placeholders', () => {
  assertEquals(
    expandLspSnippet('${1:argument}', lsp.InsertTextFormat.Snippet),
    'argument',
  );
  assertEquals(expandLspSnippet('${1}', lsp.InsertTextFormat.Snippet), '');
  assertEquals(expandLspSnippet('$1 $0', lsp.InsertTextFormat.Snippet), ' ');
  assertEquals(
    expandLspSnippet('\\$not a tabstop', lsp.InsertTextFormat.Snippet),
    '$not a tabstop',
  );
});

Deno.test('itemTextEditRange: item textEdit wins over itemDefaults', () => {
  const itemRange = {
    start: { line: 0, character: 1 },
    end: { line: 0, character: 3 },
  };
  const defaultRange = {
    start: { line: 0, character: 9 },
    end: { line: 0, character: 9 },
  };
  assertEquals(
    itemTextEditRange({
      label: 'log',
      textEdit: { range: itemRange, newText: 'log' },
    }, {
      editRange: defaultRange,
    }),
    itemRange,
  );
  assertEquals(
    itemTextEditRange({ label: 'log' }, { editRange: defaultRange }),
    defaultRange,
  );
  assertEquals(itemTextEditRange({ label: 'log' }, undefined), undefined);
  assertEquals(
    itemTextEditRange({
      label: 'log',
      textEdit: {
        newText: 'log',
        insert: itemRange,
        replace: defaultRange,
      } as never,
    }, undefined),
    itemRange,
  );
});
