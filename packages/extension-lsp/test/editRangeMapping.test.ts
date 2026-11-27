import { assertEquals } from '@std/assert';
import type { Node as PMNode } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';
import { BasicEditorKit } from '@kerebron/extension-basic-editor/BasicEditorKit';
import { CodeContentMapper } from '@kerebron/workspace/CodeContentMapper';
import type { ContentMapper } from '@kerebron/workspace';

import { isEmbeddedBlock } from '../src/embedded.ts';
import { editRangeToTextRange } from '../src/snippets.ts';

const editor = CoreEditor.create({
  editorKits: [new BasicEditorKit()],
});
const schema = editor.schema;

const CODE_CONTENT = 'console.';

// doc(paragraph("before "), code_block("console."), paragraph("after"))
interface DocPositions {
  $caret: ReturnType<PMNode['resolve']>; // ResolvedPos at end of code block
  contentStart: number; // start of the code block content
  caretPos: number;
}

function buildDoc(): DocPositions {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text('before ')),
    schema.nodes.code_block.create(
      { id: 'snippet1', lang: 'typescript' },
      schema.text(CODE_CONTENT),
    ),
    schema.nodes.paragraph.create(null, schema.text('after')),
  ]);

  let contentStart = -1;
  doc.descendants((node, pos) => {
    if (contentStart < 0 && node.type.name === 'code_block') {
      contentStart = pos + 1;
    }
    return true;
  });
  const caretPos = contentStart + CODE_CONTENT.length;

  return { $caret: doc.resolve(caretPos), contentStart, caretPos };
}

Deno.test('caret at end of nonempty code block: textOffset is 0', () => {
  const { $caret, caretPos } = buildDoc();
  assertEquals($caret.pos, caretPos);
  // Premise of the bug: the position is not inside a text node, so
  // `textOffset` is 0 even though the block content is nonempty.
  assertEquals($caret.textOffset, 0);
  assertEquals($caret.parentOffset, CODE_CONTENT.length);
});

Deno.test('editRangeToTextRange: block-relative range maps inside block', () => {
  const { contentStart, caretPos } = buildDoc();
  const contentMapper = CodeContentMapper.create(CODE_CONTENT);

  const range = editRangeToTextRange(
    { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
    contentStart,
    contentMapper,
    { from: -1, to: -1 },
  );

  // The server range [0, 8) covers the whole "console." content, so the
  // document range must span exactly the code block content.
  assertEquals(range, { from: contentStart, to: caretPos });
});

Deno.test('editRangeToTextRange: whole-document mapper needs base 0', () => {
  // A whole-document mapper's `fromLineChar` returns absolute positions, so
  // the range must be used as-is (base 0).
  const globalMapper: ContentMapper = {
    getTextContent: () => 'line of global text',
    toRawTextPos: () => -1,
    toRawTextLineCol: () => [0, 0],
    fromLineChar(line: number, column: number): number {
      return line === 0 ? 100 + column : -1;
    },
  };

  const range = editRangeToTextRange(
    { start: { line: 0, character: 2 }, end: { line: 0, character: 6 } },
    0,
    globalMapper,
    { from: -1, to: -1 },
  );

  assertEquals(range, { from: 102, to: 106 });
});

Deno.test('editRangeToTextRange: old textOffset base would overshoot the block', () => {
  const { $caret, contentStart, caretPos } = buildDoc();

  // The pre-fix formula `pos - textOffset` yields the caret position (end of
  // the block) instead of the content start, shifting every mapped range
  // past the block into following content.
  const buggyBase = $caret.pos - $caret.textOffset;
  assertEquals(buggyBase, caretPos);
  assertEquals(buggyBase === contentStart, false);
});

Deno.test('editRangeToTextRange: falls back when line is unmapped', () => {
  const { caretPos, contentStart } = buildDoc();
  const contentMapper = CodeContentMapper.create(CODE_CONTENT);

  const fallback = { from: caretPos, to: caretPos };
  const range = editRangeToTextRange(
    { start: { line: 5, character: 0 }, end: { line: 5, character: 3 } },
    contentStart,
    contentMapper,
    fallback,
  );

  assertEquals(range, fallback);
});

Deno.test('isEmbeddedBlock: code block with runtime uri', () => {
  const codeBlock = schema.nodes.code_block.create(
    { id: 'snippet1', lang: 'typescript' },
    schema.text(CODE_CONTENT),
  );

  assertEquals(
    isEmbeddedBlock({ node: codeBlock, uri: 'file:///snippet1.ts' }),
    true,
  );
  // Different uri (e.g. the document uri) -> global text.
  assertEquals(
    isEmbeddedBlock({ node: codeBlock, uri: 'file:///doc.md' }),
    false,
  );
});

Deno.test('isEmbeddedBlock: paragraph is global text', () => {
  const paragraph = schema.nodes.paragraph.create(
    null,
    schema.text('before '),
  );

  assertEquals(
    isEmbeddedBlock({ node: paragraph, uri: 'file:///doc.md' }),
    false,
  );
  assertEquals(isEmbeddedBlock({ uri: 'file:///doc.md' }), false);
});
