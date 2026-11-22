import { assertEquals } from '@std/assert';

// CodeCrock.ts reads `window` at module load; provide a fallback for Deno.
(globalThis as Record<string, unknown>).window ??= globalThis;
(globalThis as Record<string, unknown>).Node ??= { TEXT_NODE: 3 };
const { deleteInvisibleBeforeCaret, ZWSP } = await import(
  '../src/CodeCrock.ts'
);

// Stand-in for a DOM Text node (nodeType 3).
type FakeText = {
  nodeType: number;
  nodeValue: string;
  previousSibling: FakeText | null;
};

type FakeRange = { startContainer: FakeText; startOffset: number };

type FakeSelection = {
  isCollapsed: boolean;
  rangeCount: number;
  caretNode: unknown;
  caretOffset: number;
  getRangeAt(index: number): FakeRange;
  setBaseAndExtent(
    anchorNode: unknown,
    anchorOffset: number,
    focusNode: unknown,
    focusOffset: number,
  ): void;
};

function makeText(
  value: string,
  previousSibling: FakeText | null = null,
): FakeText {
  return { nodeType: 3, nodeValue: value, previousSibling };
}

function makeSelection(node: FakeText, offset: number): FakeSelection {
  return {
    isCollapsed: true,
    rangeCount: 1,
    caretNode: null,
    caretOffset: -1,
    getRangeAt: () => ({ startContainer: node, startOffset: offset }),
    setBaseAndExtent(anchorNode, anchorOffset, _focusNode, focusOffset) {
      this.caretNode = anchorNode;
      this.caretOffset = focusOffset;
    },
  };
}

function makeCodeCrock(sel: FakeSelection) {
  return { getSelection: () => sel } as unknown as Parameters<
    typeof deleteInvisibleBeforeCaret
  >[0];
}

Deno.test('deleteInvisibleBeforeCaret removes BMP char before ZWSP', () => {
  const node = makeText('ab' + ZWSP);
  const sel = makeSelection(node, 3);
  assert(deleteInvisibleBeforeCaret(makeCodeCrock(sel)));
  assertEquals(node.nodeValue, 'a');
  assertEquals(sel.caretNode, node);
  assertEquals(sel.caretOffset, 1);
});

Deno.test('deleteInvisibleBeforeCaret removes full emoji before ZWSP', () => {
  const node = makeText('a\uD83D\uDE00' + ZWSP); // a + 😀 + ZWSP
  const sel = makeSelection(node, 4);
  assert(deleteInvisibleBeforeCaret(makeCodeCrock(sel)));
  assertEquals(node.nodeValue, 'a');
  assertEquals(sel.caretOffset, 1);
});

Deno.test('deleteInvisibleBeforeCaret removes full emoji from previous node', () => {
  const prev = makeText('x\uD83D\uDE00'); // x + 😀
  const node = makeText(ZWSP + 'b', prev);
  const sel = makeSelection(node, 1);
  assert(deleteInvisibleBeforeCaret(makeCodeCrock(sel)));
  assertEquals(prev.nodeValue, 'x');
  assertEquals(node.nodeValue, 'b');
  assertEquals(sel.caretNode, prev);
  assertEquals(sel.caretOffset, 1);
});

Deno.test('deleteInvisibleBeforeCaret removes BMP char from previous node', () => {
  const prev = makeText('xy');
  const node = makeText(ZWSP + 'b', prev);
  const sel = makeSelection(node, 1);
  assert(deleteInvisibleBeforeCaret(makeCodeCrock(sel)));
  assertEquals(prev.nodeValue, 'x');
  assertEquals(node.nodeValue, 'b');
  assertEquals(sel.caretOffset, 1);
});

Deno.test('deleteInvisibleBeforeCaret is a no-op without ZWSP', () => {
  const node = makeText('abc');
  const sel = makeSelection(node, 3);
  assertEquals(deleteInvisibleBeforeCaret(makeCodeCrock(sel)), false);
  assertEquals(node.nodeValue, 'abc');
});

function assert(value: unknown): asserts value {
  if (!value) throw new Error('expected truthy, got: ' + String(value));
}
