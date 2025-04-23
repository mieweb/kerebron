import { next as automerge } from '@automerge/automerge';

import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertFalse,
  AssertionError,
} from '@std/assert';
import { deepStrictEqual } from 'node:assert';

import {
  amIdxToPmBlockIdx,
  amSpansToDoc,
  amSpliceIdxToPmIdx,
  blockAtIdx,
  eventsWithIndexChanges,
  TraversalEvent,
  traverseNode,
  traverseSpans,
} from '../src/amTraversal.ts';

import { pmNodeToSpans, pmRangeToAmRange } from '../src/pmTraversal.ts';

import { describe, docFromBlocksNotation, makeDoc } from './testUtils.ts';
import { SchemaAdapter } from '../src/SchemaAdapter.ts';
import { schema } from './basicSchema.ts';

const basicSchemaAdapter = new SchemaAdapter(schema);

describe('the traversal API', () => {
  describe('the amSpliceIdxToPmIdx function', () => {
    Deno.test('should return the last prosemirror text index before the given automerge index', () => {
      const { spans } = docFromBlocksNotation([
        {
          type: 'paragraph',
          parents: ['ordered_list', 'list_item'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:             0  1 2 3 4  5  6
      //      <ol> <li> <p> i t e m ' ' 1</p> </li> </ol>
      // pm: 0    1    2   3 4 5 6 7   8 9   10    11    12
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 6), 8);
    });

    Deno.test('should include the render-only <p> tag in a document with no top level paragraph block', () => {
      const { spans } = docFromBlocksNotation(['hello']);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 0), 1);
    });

    Deno.test('should return the first text index in a document after initial paragraph blocks', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'paragraph', parents: [], attrs: {} },
        'hello world',
      ]);
      // am:   0  1 2 3 4 5  6  7 8 9  10 11
      //      <p> h e l l o ' ' w o r  l  d </p>
      // pm: 0   1 2 3 4 5 6  7  8 9 10 11 12
      //
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 1);
    });

    Deno.test('should return a text index after a block idx', () => {
      const { spans } = docFromBlocksNotation([
        {
          type: 'paragraph',
          parents: ['ordered_list', 'list_item'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:             0  1 2 3 4  5  6
      //      <ol> <li> <p> i t e m ' ' 1</p> </li> </ol>
      // pm: 0    1    2   3 4 5 6 7   8 9   10    11    12
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 3);
    });

    Deno.test('should return a text index inside a render-only node after a block', () => {
      const { spans } = docFromBlocksNotation([
        {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'bullet_list'],
          attrs: {},
        },
      ]);
      // am:                            0
      //      <ol> <li> <p> </p> <ul> <li> <p> </p> </li> </ul> </li> </ol>
      // pm: 0    1    2   3    4    5    6   7    8     9     10    11    12
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 0), 3);
    });

    Deno.test('should return a text index inside text in a render-only node after a block', () => {
      const { spans } = docFromBlocksNotation([
        {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'bullet_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:                        0           1 2 3  4   5   6
      //      <ol> <li>  <p> </p> <ul> <li> <p> i t e  m  ' '  1  </p> </li> </ul> </li> </ol>
      // pm: 0    1    2    3    4    5    6   7 8 9 10 11  12  13   14    15   16    17
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 7);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 2), 8);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 4), 10);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 6), 12);
    });

    Deno.test('should return the first index in a render-only node after closing parents', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'paragraph', parents: [], attrs: {} },
        'paragraph',
        {
          type: 'list_item',
          parents: ['bullet_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
      ]);
      // am:   0  1 2 3 4 5 6 7 8 9                               10
      //      <p> p a r a g r a p h </p> <ul> <li> <p> </p> <ol> <li> <p> </p> </li> </ol> </li> </ul>
      // pm: 0   1 2 3 4 5 5 6 6 9 10   11   12   13  14   15   16   17  18   19    20    21    22    22
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 1);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 10), 14);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 11), 18);
    });

    Deno.test('should return the first index in text in a render-only node after closing parents', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'paragraph', parents: [], attrs: {} },
        'paragraph',
        {
          type: 'list_item',
          parents: ['bullet_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:   0  1 2 3 4 5 6 7 8 9                               10       11  12 13 14 15   16
      //      <p> p a r a g r a p h </p> <ul> <li> <p> </p> <ol> <li> <p>  i   t  e  m  ' '  1 </p> </li> </ol> </li> </ul>
      // pm: 0   1 2 3 4 5 5 6 6 9 10   11   12   13  14   15   16   17  18 19 20 21  22   23  24  25   26    27    28
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 0), 1);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 10), 14);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 11), 18);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 12), 19);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 16), 23);
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 17), 24);
    });

    Deno.test('should return the internal index of an empty paragraph tag', () => {
      const { spans } = docFromBlocksNotation([
        'hello',
        { type: 'paragraph', parents: [], attrs: {} },
        { type: 'paragraph', parents: [], attrs: {} },
        'world',
      ]);
      // am:      0 1 2 3 4       5        6  7  8  9  10 11
      //      <p> h e l l o </p> <p> </p> <p> w  o  r  l  d </p>
      // pm: 0   1 2 3 4 5 6    7   8    9  10 11 12 13 14 15   16
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 6), 8);
    });

    Deno.test('should find the correct index for the last character in a nexted list item', () => {
      const { spans } = docFromBlocksNotation([
        {
          type: 'list_item',
          parents: ['bullet_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:                                  0      1 2 3  4  5  6
      //      <doc> <ul> <li> <p> </p> <ol> <li> <p> i t e  m ' ' 1 </p> </li> </ol> </li> </ul> </doc>
      // pm:       0    1    2   3    4    5    6   7 8 9 10 11 12 13   14   15     16    17    18
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 7), 13);
    });

    Deno.test('should find the index after an empty nested list item', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        'item one',
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
        'item two',
      ]);
      // am:              0       1 2 3 4  5  6  7  8              9                  10      11 12 13 14  15  16
      //      <doc> <ul> <li> <p> i t e m ' ' o  n  e </p> </li> <li> <p> </p> <ol>  <li> <p> i  t  e  m  ' '  2  </p> </li> </ol> </li> </ul> </doc>
      // pm:       0    1    2   3 4 5 6 7   8  9 10 11   12    13   14  15   16   17    18  19 20 21 22 23  24  25   26   27    28    29    30     31
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 10), 15);
    });

    Deno.test('should find the index after an embed tag', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('image'),
            parents: [new automerge.RawString('paragraph')],
            attrs: {
              alt: 'Andromeda Galaxy',
              src: new automerge.RawString(
                'https://archive.org/services/img/Hubble_Andromeda_Galaxy_',
              ),
              title: 'Andromeda Galaxy',
            },
            isEmbed: true,
          },
        },
      ];
      // am:         0   1
      //     <doc>  <p> <img src="http://example.com/image.png" /> </p> </doc>
      // pm: 0     0   1                                          2    3      4
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 2), 2);
    });

    Deno.test('should find the index inside a lone header tag', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: 'heading',
            parents: [],
            attrs: { level: 1 },
          },
        },
      ];
      // am         0
      //     <doc> <h1> </h1> </doc>
      // pm 0     0    1     2
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 1);
    });

    Deno.test('should find the first index inside a code block at the start of the document', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('code-block'),
            attrs: {},
            parents: [],
          },
        },
      ];
      assertEquals(amSpliceIdxToPmIdx(basicSchemaAdapter, spans, 1), 1);
    });
  });

  describe('the pmRangeToAmRange function', () => {
    Deno.test('should return the automerge text indexes between the given prosemirror indexes', () => {
      const { spans } = makeDoc([
        { type: 'paragraph', parents: [], attrs: {} },
        'hello',
      ]);
      // am:   0  1 2 3 4 5
      //      <p> h e l l o </p>
      // pm: 0   1 2 3 4 5 6
      //
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 0, to: 6 }),
        {
          start: 0,
          end: 6,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 6 }),
        {
          start: 1,
          end: 6,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 6 }),
        {
          start: 2,
          end: 6,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 5 }),
        {
          start: 2,
          end: 5,
        },
      );
    });

    Deno.test('should return the automerge text index before and after the given prosemirror indexes in a nested block', () => {
      const { spans } = makeDoc([
        { type: 'list_item', parents: ['bullet_list'], attrs: {} },
        'item 1',
      ]);
      // am:        0       1 2 3 4  5  6
      //      <ul> <li> <p> i t e m ' ' 1 </p> </li> </ul>
      // pm: 0    1    2   3 4 5 6 7   8 9   10    11    12
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 0, to: 12 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 12 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 12 }),
        {
          start: 1,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 3, to: 12 }),
        {
          start: 1,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 11 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 10 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 9 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 8 }),
        {
          start: 2,
          end: 6,
        },
      );
    });

    Deno.test('should return the automerge text indexes before and after the given prosemirror indexes in a nested block with a render-only wrapper', () => {
      const { spans } = makeDoc([
        {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'bullet_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:                            0      1 2 3  4  5   6
      //      <ol> <li> <p> </p> <ul> <li> <p> i t e  m ' '  1 </p> </li> </ul> </li> </ol>
      // pm: 0    1    2   3    4    5    6   7 8 9 10 11  12 13   14    15   16    17     18
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 0, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 3, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 5, to: 18 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 6, to: 18 }),
        {
          start: 1,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 7, to: 18 }),
        {
          start: 1,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 18 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 9, to: 18 }),
        {
          start: 3,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 17 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 16 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 15 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 14 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 13 }),
        {
          start: 2,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 12 }),
        {
          start: 2,
          end: 6,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 8, to: 11 }),
        {
          start: 2,
          end: 5,
        },
      );
    });

    Deno.test('should return the automerge text indexes before and after the given prosemirror indexes in a document with sibling blocks', () => {
      const { spans } = makeDoc([
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        'item 1',
        {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'bullet_list'],
          attrs: {},
        },
        'item 2',
      ]);
      // am:        0       1 2 3 4  5  6              7       8  9  10 11 12  13
      //      <ol> <li> <p> i t e m ' ' 1  </p> <ul> <li> <p>  i  t  e  m  ' '  2  </p> </li> </ul> </li> </ol>
      // pm: 0    1    2   3 4 5 6 7   8  9    10   11   12  13 14 15 16 17   18 19   20     21   22     23    24

      // Check indices in the first <p>
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 24 }),
        {
          start: 0,
          end: 14,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 9 }),
        {
          start: 0,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 9 }),
        {
          start: 1,
          end: 7,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 8 }),
        {
          start: 1,
          end: 6,
        },
      );

      // Check indices in the second <p>
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 11, to: 24 }),
        {
          start: 7,
          end: 14,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 13, to: 24 }),
        {
          start: 8,
          end: 14,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 12, to: 18 }),
        {
          start: 8,
          end: 13,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 13, to: 18 }),
        {
          start: 8,
          end: 13,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 14, to: 18 }),
        {
          start: 9,
          end: 13,
        },
      );

      ////// check indices which span both <p>s
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 2, to: 19 }),
        {
          start: 1,
          end: 14,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 3, to: 19 }),
        {
          start: 1,
          end: 14,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 18 }),
        {
          start: 2,
          end: 13,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 13 }),
        {
          start: 2,
          end: 8,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 4, to: 12 }),
        {
          start: 2,
          end: 8,
        },
      );
    });

    Deno.test('should return the automerge index following the prosemirror index for zero length ranges', () => {
      const { spans } = makeDoc([
        { type: 'list_item', parents: ['bullet_list'], attrs: {} },
        {
          type: 'list_item',
          parents: ['bullet_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:               0                  1       2 3 4  4   6   7
      //       <doc> <ul> <li> <p> </p> <ol> <li> <p> i t e  m  ' '  1 </p> </li> </ol> </li> </ul> </doc>
      // pm:        0    1    2   3    4    5    5   7 8 9 10 11   12 13   14   15     16    17    18
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 7, to: 7 }),
        {
          start: 2,
          end: 2,
        },
      );
    });

    Deno.test('should return the automerge index in the middle of a paragraph', () => {
      const { spans } = makeDoc(['hello world']);
      // am:      0 1 2 3 4  5  6 7 8  9  10
      //      <p> h e l l o ' ' w o r  l  d  </p>
      // pm: 0   1 2 3 4 5 6   7 8 9 10 11 12
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 7, to: 7 }),
        {
          start: 6,
          end: 6,
        },
      );
    });

    Deno.test('should return the automerge index following an empty paragraph', () => {
      const { spans } = makeDoc([
        'hello ',
        { type: 'paragraph', parents: [], attrs: {} },
        { type: 'paragraph', parents: [], attrs: {} },
        'world',
      ]);
      // am:      0 1 2 3 4  5        6        7   8  9  10 11 12
      //      <p> h e l l o ' ' </p> <p> </p> <p>  w  o  r  l  d </p>
      // pm: 0   1 2 3 4 5 6   7    8   9   10   11 12 13 14 15 16   17
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 9, to: 9 }),
        {
          start: 7,
          end: 7,
        },
      );
    });

    Deno.test('should find the correct range for the last character in the document', () => {
      const { spans } = makeDoc(['hello world']);
      // am:      0 1 2 3 4  5  6  7  8  9  10
      //      <p> h e l l o ' ' w  o  r  l  d </p>
      // pm: 0   1 2 3 4 5 6   7  8  9 10 11 12  13
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 11, to: 12 }),
        {
          start: 10,
          end: 11,
        },
      );
    });

    Deno.test('should find the last character in a document with mixed explicit and render-only paragraphs', () => {
      const { spans } = makeDoc([
        'hello world',
        { type: 'paragraph', parents: [], attrs: {} },
      ]);
      // am:      0 1 2 3 4  5  6  7  8  9  10     11
      //      <p> h e l l o ' ' w  o  r  l  d </p> <p> </p>
      // pm: 0   1 2 3 4 5 6   7  8  9 10 11 12  13   14
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 14, to: 14 }),
        {
          start: 12,
          end: 12,
        },
      );
    });

    Deno.test('should return zero length ranges for zero length prosemirror ranges', () => {
      const { spans } = makeDoc([
        'hello ',
        { type: 'paragraph', parents: [], attrs: {} },
        'world',
      ]);
      // am:      0 1 2 3 4  5        6  7  8  9  10 11
      //      <p> h e l l o ' ' </p> <p> w  o  r  l  d </p>
      // pm: 0   1 2 3 4 5 6   7    8   9 10 11 12 13 14  15
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 5, to: 5 }),
        {
          start: 4,
          end: 4,
        },
      );
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 9, to: 9 }),
        {
          start: 7,
          end: 7,
        },
      );
    });

    Deno.test('should return the correct range for the end of a list item', () => {
      const { spans } = makeDoc([
        {
          type: 'list_item',
          parents: ['bullet_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
        'item 1',
      ]);
      // am:                                  0      1 2 3 4  5  6
      //      <doc> <ul> <li> <p> </p> <ol> <li> <p> i t e m ' ' 1 </p> </li> </ol> </li> </ul> </doc>
      // pm: 0     1    2    3   4    5    6    7   8 9 10  11 12 13   14   15     16    17    18
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 13, to: 13 }),
        {
          start: 7,
          end: 7,
        },
      );
    });

    Deno.test('should only count embed nodes as a single character', () => {
      const { spans } = makeDoc([
        { type: 'paragraph', parents: [], attrs: {} },
        {
          type: 'image',
          parents: ['paragraph'],
          attrs: { src: 'http://example.com/image.png', isEmbed: true },
        },
      ]);

      // am:         0   1
      //      <doc> <p> <img src="http://example.com/image.png" /> </p> </doc>
      // pm: 0     0   1                                          2    3      4
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 2 }),
        {
          start: 1,
          end: 2,
        },
      );
    });

    Deno.test('should return the range around bare text', () => {
      const { spans } = makeDoc(['a']);

      // am:      0
      //      <p> a </p>
      // pm: 0   1 2     3
      assertEquals(
        pmRangeToAmRange(basicSchemaAdapter, spans, { from: 1, to: 2 }),
        {
          start: 0,
          end: 1,
        },
      );
    });
  });

  describe('the blockAtIdx function', () => {
    const { spans } = docFromBlocksNotation([
      'hello',
      { type: 'paragraph', parents: [], attrs: {} },
      'world',
    ]);

    Deno.test('should return null if in the initial text', () => {
      assertFalse(blockAtIdx(spans, 0));
      assertFalse(blockAtIdx(spans, 2));
      assertFalse(blockAtIdx(spans, 3));
      assertFalse(blockAtIdx(spans, 4));
    });

    Deno.test('should return the active block on a block boundary', () => {
      deepStrictEqual(blockAtIdx(spans, 5), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
    });

    Deno.test('should return the active block after a span boundary', () => {
      deepStrictEqual(blockAtIdx(spans, 6), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
      deepStrictEqual(blockAtIdx(spans, 7), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
      deepStrictEqual(blockAtIdx(spans, 8), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
      deepStrictEqual(blockAtIdx(spans, 9), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
      deepStrictEqual(blockAtIdx(spans, 10), {
        index: 5,
        block: {
          type: new automerge.RawString('paragraph'),
          parents: [],
          attrs: {},
        },
      });
    });

    Deno.test('should return the active block for nested lists', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        'item 1',
      ]);
      deepStrictEqual(blockAtIdx(spans, 0), {
        index: 0,
        block: {
          type: new automerge.RawString('list_item'),
          parents: [new automerge.RawString('ordered_list')],
          attrs: {},
        },
      });
    });
  });

  describe('the traverseSpans function', () => {
    Deno.test('should return a single paragraph for empty spans', () => {
      const spans: automerge.Span[] = [];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertEquals(events, [
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
      ]);
    });

    Deno.test('should return the correct events for a nested list with inner wrapper', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('ordered_list'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
      ];
      assertEquals(events, expected);
    });

    Deno.test('should return the correct events for two sibling paragraphs', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello' },
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'world' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      const expected: TraversalEvent[] = [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
      ];
      assertEquals(events, expected);
    });

    Deno.test('should return the correct events for a paragraph in a list', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'hello' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
      ];
      assertTraversalEqual(events, expected);
    });

    Deno.test('should return the correct events for a paragraph followed by a nested list item', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'paragraph' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('ordered_list'),
            ],
            attrs: {},
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      const expected: TraversalEvent[] = [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'paragraph', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
      ];
      assertTraversalEqual(events, expected);
    });

    Deno.test('a list item between two paragraphs', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 3' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 2', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 3', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
      ]);
    });

    Deno.test('a nested list with trailing empty list item', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 2', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
      ]);
    });

    Deno.test('list with trailing empty paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
      ]);
    });

    Deno.test('a list item with mixed text and nested paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('bullet_list')],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item 2' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item 2', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
      ]);
    });

    Deno.test('consecutive text spans', () => {
      const spans: automerge.Span[] = [
        { type: 'text', value: 'hello ' },
        { type: 'text', value: 'world' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'hello ', marks: {} },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
      ]);
    });

    Deno.test('consecutive text spans nested in a list item', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('bullet_list')],
            attrs: {},
          },
        },
        { type: 'text', value: 'hello ' },
        { type: 'text', value: 'world' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'hello ', marks: {} },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
      ]);
    });

    Deno.test('creates aside blocks with inner paragraph wrappers', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('aside'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'aside',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'aside', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'aside', role: 'explicit' },
      ]);
    });

    Deno.test('creates heading blocks with the correct attributes', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('heading'),
            parents: [],
            attrs: { level: 1 },
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('heading'),
            parents: [],
            attrs: { level: 2 },
            isEmbed: false,
          },
        },
        { type: 'text', value: 'world' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'heading',
            parents: [],
            attrs: { level: 1 },
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'heading', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'heading', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'heading',
            parents: [],
            attrs: { level: 2 },
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'heading', role: 'explicit' },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'heading', role: 'explicit' },
      ]);
    });

    Deno.test('should infer wrapping paragraph nodes for empty list items before a nested list', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
            isEmbed: false,
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('ordered_list'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
      ];

      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },

        // First block
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'item 1', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },

        // Second block
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },

        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        // Third block
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list', 'list_item', 'ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'item 2', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },

        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
      ]);
    });

    Deno.test('should recognise image spans', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('image'),
            parents: [new automerge.RawString('paragraph')],
            attrs: {
              src: new automerge.RawString('image.png'),
              alt: 'image alt',
              title: 'image title',
            },
            isEmbed: true,
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'image',
            parents: ['paragraph'],
            attrs: {
              src: 'image.png',
              alt: 'image alt',
              title: 'image title',
            },
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'image', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
      ]);
    });

    Deno.test('should immediately close image tags', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('image'),
            parents: [new automerge.RawString('paragraph')],
            attrs: {
              src: new automerge.RawString('image.png'),
              alt: 'image alt',
              title: 'image title',
            },
            isEmbed: true,
          },
        },
        { type: 'text', value: 'hello' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'image',
            parents: ['paragraph'],
            attrs: {
              src: 'image.png',
              alt: 'image alt',
              title: 'image title',
            },
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'image', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
      ]);
    });

    Deno.test('should construct the correct spans from a list item followed by a paragraph in a blockquote', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('blockquote'),
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [new automerge.RawString('blockquote')],
            attrs: {},
          },
        },
        { type: 'text', value: 'hello' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'blockquote', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote', 'bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'blockquote', role: 'render-only' },
      ]);
    });

    Deno.test('should generate code_blocks', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('code-block'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'var x' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'code-block',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'code_block', role: 'explicit' },
        { type: 'text', text: 'var x', marks: {} },
        { type: 'closeTag', tag: 'code_block', role: 'explicit' },
      ]);
    });

    Deno.test('should generate a paragraph in a list item following a header', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('heading'),
            parents: [],
            attrs: { level: 1 },
            isEmbed: false,
          },
        },
        { type: 'text', value: 'heading' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'some text' },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'heading',
            parents: [],
            attrs: { level: 1 },
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'heading', role: 'explicit' },
        { type: 'text', text: 'heading', marks: {} },
        { type: 'closeTag', tag: 'heading', role: 'explicit' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'some text', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
      ]);
    });

    Deno.test('should generate a nested list following a paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello world' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item one' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('bullet_list'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
      ];
      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'hello world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item one', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
      ]);
    });
  });

  describe('the traverseNode function', () => {
    const schema = basicSchemaAdapter.schema;
    Deno.test('should emit block markers for list elements without {isAmgBlock: true} it', () => {
      const node = schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [schema.node('paragraph', null, [])]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ];
      assertEquals(events, expected);
    });

    Deno.test('should not emit block markers for list elements with any child which has isAmgBlock: true', () => {
      const node = schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', { isAmgBlock: true }, []),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ];
      assertTraversalEqual(events, expected);
    });

    Deno.test('should not emit block markers for list elements with any descendant that has isAmgBlock: true', () => {
      const node = schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', null, []),
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ];
      assertTraversalEqual(events, expected);
    });

    Deno.test('should emit block markers for children of list items where the first child does not have isAmgBlock:true but the item has multiple paragraphs', () => {
      const node = schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', { isAmgBlock: false }, []),
            schema.node('paragraph', { isAmgBlock: true }, []),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ];
      assertTraversalEqual(events, expected);
    });

    Deno.test('should recognise header blocks', () => {
      const node = schema.node('doc', null, [
        schema.node('heading', { level: 1 }, [schema.text('hello')]),
        schema.node('heading', { level: 2 }, [schema.text('world')]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      const expected: TraversalEvent[] = [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'heading',
            parents: [],
            attrs: { level: 1 },
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'heading', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'heading', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'heading',
            parents: [],
            attrs: { level: 2 },
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'heading', role: 'explicit' },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'heading', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ];
      assertEquals(events, expected);
    });

    Deno.test('should recognise image tags', () => {
      const node = schema.node('doc', null, [
        schema.node('paragraph', null, [
          schema.node('image', {
            src: 'some-image.png',
            alt: 'some image',
            title: 'some title',
          }),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'image',
            parents: [],
            attrs: {
              src: new automerge.RawString('some-image.png'),
              alt: 'some image',
              title: 'some title',
            },
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'image', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should recognise text in blockquotes', () => {
      const node = schema.node('doc', null, [
        schema.node('blockquote', null, [schema.node('paragraph', null, [])]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'blockquote',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'blockquote', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'blockquote', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should not emit a block marker for the first paragraph in blockquotes', () => {
      const node = schema.node('doc', null, [
        schema.node('blockquote', null, [
          schema.node('paragraph', null, [schema.text('hello')]),
          schema.node('paragraph', null, [schema.text('world')]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'blockquote',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'blockquote', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'blockquote', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('recognises list items in blockquotes', () => {
      const doc = schema.node('doc', null, [
        schema.node('blockquote', null, [
          schema.node('bullet_list', null, [
            schema.node('list_item', null, [
              schema.node('paragraph', null, []),
            ]),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, doc));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'blockquote', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['blockquote', 'bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'blockquote', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('recognises list items in a blockquote with paragraphs following', () => {
      const doc = schema.node('doc', null, [
        schema.node('blockquote', null, [
          schema.node('bullet_list', null, [
            schema.node('list_item', null, [
              schema.node('paragraph', { isAmgBlock: true }, []),
            ]),
          ]),
          schema.node('paragraph', null, []),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, doc));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'blockquote', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote', 'bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'blockquote', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should construct a blockquote with two lists separated by a paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('blockquote'),
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'some quote' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [new automerge.RawString('blockquote')],
            attrs: {},
          },
        },
        { type: 'text', value: 'middle' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('blockquote'),
              new automerge.RawString('bullet_list'),
            ],
            attrs: {},
          },
        },
      ];

      const events = Array.from(traverseSpans(basicSchemaAdapter, spans));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'blockquote', role: 'render-only' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote', 'bullet_list', 'list_item'],
            isEmbed: false,
            attrs: {},
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'some quote', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['blockquote'],
            isEmbed: false,
            attrs: {},
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'middle', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['blockquote', 'bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'blockquote', role: 'render-only' },
      ]);
    });

    Deno.test('should recognise code blocks', () => {
      const node = schema.node('doc', null, [
        schema.node('code_block', null, [schema.text('var x')]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'code-block',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'code_block', role: 'explicit' },
        { type: 'text', text: 'var x', marks: {} },
        { type: 'closeTag', tag: 'code_block', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should recognise a nested list following a paragraph', () => {
      const node = schema.node('doc', null, [
        schema.node('paragraph', { isAmgBlock: true }, [
          schema.text('hello world'),
        ]),
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item one'),
            ]),
            schema.node('bullet_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'hello world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'openTag', tag: 'list_item', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: ['bullet_list', 'list_item'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'text', text: 'item one', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'bullet_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'bullet_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'render-only' },
        { type: 'closeTag', tag: 'bullet_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should not emit block markers for multiple top level leaf nodes of different types', () => {
      const node = schema.node('doc', null, [
        schema.node('paragraph', null, [
          schema.nodes.unknownLeaf.create({
            unknownBlock: {
              type: 'unknown',
              parents: [],
              attrs: {},
              isEmbed: true,
            },
          }),
          schema.text('hello'),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: true,
          block: {
            type: 'unknown',
            parents: [],
            attrs: {},
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'unknownLeaf', role: 'explicit' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should not emit parents which are wrapper content', () => {
      const node = schema.node('doc', null, [
        schema.node('paragraph', null, [
          schema.node('image', {
            src: 'some-image.png',
            alt: 'some image',
            title: 'some title',
            isAmgBlock: true,
            unknownAttrs: null,
          }),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'image',
            parents: [],
            attrs: {
              src: new automerge.RawString('some-image.png'),
              alt: 'some image',
              title: 'some title',
            },
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'image', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should emit parents which are wrapper content if they are explicit blocks', () => {
      const node = schema.node('doc', null, [
        schema.node('paragraph', { isAmgBlock: true }, [
          schema.node('image', {
            src: 'some-image.png',
            alt: 'some image',
            title: 'some title',
            isAmgBlock: true,
            unknownAttrs: null,
          }),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'image',
            parents: ['paragraph'],
            attrs: {
              src: new automerge.RawString('some-image.png'),
              alt: 'some image',
              title: 'some title',
            },
            isEmbed: true,
          },
        },
        { type: 'leafNode', tag: 'image', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should generate block markers when there are insertions inside an unknown block', () => {
      const node = schema.node('doc', null, [
        schema.node('unknownBlock', { unknownParentBlock: 'unknown' }, [
          schema.node('paragraph', null, [schema.text('hello')]),
          schema.node(
            'unknownBlock',
            {
              isAmgBlock: true,
              unknownBlock: {
                type: 'unknown',
                parents: ['unknown'],
                attrs: {},
                isEmbed: false,
              },
            },
            [schema.node('paragraph', null, [schema.text('world')])],
          ),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, node));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: true,
          block: {
            type: 'unknown',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'unknownBlock', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'hello', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        {
          type: 'block',
          isUnknown: true,
          block: {
            type: 'unknown',
            parents: ['unknown'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'unknownBlock', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'text', text: 'world', marks: {} },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'unknownBlock', role: 'explicit' },
        { type: 'closeTag', tag: 'unknownBlock', role: 'explicit' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });

    Deno.test('should emit block markers for a leading render-only paragraph at the beginning of the doc', () => {
      const doc = schema.node('doc', null, [
        schema.node('paragraph', null, []),
        schema.node('ordered_list', null, [
          schema.node('list_item', { isAmgBlock: true }, [
            schema.node('paragraph', null, []),
          ]),
        ]),
      ]);
      const events = Array.from(traverseNode(basicSchemaAdapter, doc));
      assertTraversalEqual(events, [
        { type: 'openTag', tag: 'doc', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'paragraph',
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'paragraph', role: 'explicit' },
        { type: 'closeTag', tag: 'paragraph', role: 'explicit' },
        { type: 'openTag', tag: 'ordered_list', role: 'render-only' },
        {
          type: 'block',
          isUnknown: false,
          block: {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'openTag', tag: 'list_item', role: 'explicit' },
        { type: 'openTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
        { type: 'closeTag', tag: 'list_item', role: 'explicit' },
        { type: 'closeTag', tag: 'ordered_list', role: 'render-only' },
        { type: 'closeTag', tag: 'doc', role: 'render-only' },
      ]);
    });
  });

  describe('the amIdxToPmBlockIdx function', () => {
    Deno.test('should return the index just before the start of a paragraph block', () => {
      const { spans } = docFromBlocksNotation([
        'hello',
        { type: 'paragraph', parents: [], attrs: {} },
        'world',
      ]);

      // am:      0 1 2 3 4       5  6  7  8  9  10
      //      <p> h e l l o </p> <p> w  o  r  l  d </p>
      // pm: 0   1 2 3 4 5 6    7   8 9  10 11 12 13   14

      // Everything in the first block should return the position just afte the opening <p>
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 0), 1);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 1), 1);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 2), 1);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 3), 1);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 4), 1);

      // Everything in the second block should return the position just after the second opening <p>
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 5), 8);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 6), 8);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 7), 8);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 8), 8);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 9), 8);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 10), 8);
    });

    Deno.test('should return the index just before list items', () => {
      const { spans } = docFromBlocksNotation([
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        'item 1',
        { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        'item 2',
      ]);

      // am:          0      1 2 3 4  5  6             7        8  9  10 11  12 13
      //       <ol> <li> <p> i t e m ' ' 1 </p> </li> <li> <p>  i  t  e  m  ' ' 2  </p> </li> </ol>
      // pm: 0     1    2   3 4 5 6 7   8 9   10     11   12  13 14 15 16 17  18 19   20    21    22

      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 0), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 1), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 2), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 3), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 4), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 5), 2);
      assertEquals(amIdxToPmBlockIdx(basicSchemaAdapter, spans, 6), 2);
    });
  });
  describe('the amSpansToDoc function', () => {
    const schema = basicSchemaAdapter.schema;
    Deno.test('should construct a documnt with extra render-only paragraphs for nested list items', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('ordered_list'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('bullet_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', null, []),
                schema.node('ordered_list', null, [
                  schema.node('list_item', { isAmgBlock: true }, [
                    schema.node('paragraph', null, [schema.text('item 1')]),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should return a document with a single list in it for multiple list item spans', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 1')]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 2')]),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should work with a list item in the middle of two paragraphs', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 3' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);

      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', { isAmgBlock: true }, [
                  schema.text('item 2'),
                ]),
              ]),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 3'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should allow empty trailing list items', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('ordered_list')],
            attrs: {},
          },
        },
      ];

      const doc = amSpansToDoc(basicSchemaAdapter, spans);

      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', { isAmgBlock: true }, [
                  schema.text('item 2'),
                ]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should work with trailing nested paragraphs', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('paragraph'),
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            type: new automerge.RawString('paragraph'),
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
        {
          type: 'block',
          value: {
            parents: [new automerge.RawString('ordered_list')],
            type: new automerge.RawString('list_item'),
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('ordered_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
      ];

      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', { isAmgBlock: true }, [
                  schema.text('item 2'),
                ]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', { isAmgBlock: true }, []),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('a nested list with trailing empty paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('bullet_list')],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('bullet_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 1')]),
                schema.node('paragraph', { isAmgBlock: true }, [
                  schema.text('item 2'),
                ]),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('consecutive ordered and unordered list items', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            parents: [new automerge.RawString('bullet_list')],
            type: new automerge.RawString('list_item'),
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
        {
          type: 'block',
          value: {
            parents: [new automerge.RawString('ordered_list')],
            type: new automerge.RawString('list_item'),
            attrs: {},
          },
        },
        { type: 'text', value: 'item 2' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);

      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('bullet_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 1')]),
              ]),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 2')]),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('constructs asides', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('aside'),
            parents: [],
            attrs: {},
          },
        },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('aside', { isAmgBlock: true }, [
              schema.node('paragraph', null, []),
            ]),
          ]),
        ),
      );
    });

    Deno.test('constructs asides with content', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('paragraph'),
            attrs: {},
          },
        },
        { type: 'text', value: 'hello world' },
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('paragraph'),
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('aside'),
            attrs: {},
          },
        },
        { type: 'text', value: 'next line' },
      ];

      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('hello world'),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, []),
            schema.node('aside', { isAmgBlock: true }, [
              schema.node('paragraph', null, [schema.text('next line')]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('constructs headers with the correct level', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('heading'),
            attrs: { level: 1 },
          },
        },
        { type: 'text', value: 'hello' },
        {
          type: 'block',
          value: {
            parents: [],
            type: new automerge.RawString('heading'),
            attrs: { level: 2 },
          },
        },
        { type: 'text', value: 'world' },
      ];

      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('heading', { isAmgBlock: true, level: 1 }, [
              schema.text('hello'),
            ]),
            schema.node('heading', { isAmgBlock: true, level: 2 }, [
              schema.text('world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should construct image blocks', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('image'),
            parents: [new automerge.RawString('paragraph')],
            attrs: {
              alt: 'image alt',
              src: new automerge.RawString('image.png'),
              title: 'image title',
            },
            isEmbed: true,
          },
        },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.node(
                'image',
                {
                  isAmgBlock: true,
                  src: 'image.png',
                  alt: 'image alt',
                  title: 'image title',
                  isEmbed: true,
                },
                [],
              ),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should construct blockquotes', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [new automerge.RawString('blockquote')],
            attrs: {},
          },
        },
        { type: 'text', value: 'hello' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [new automerge.RawString('blockquote')],
            attrs: {},
          },
        },
        { type: 'text', value: 'world' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('blockquote', null, [
              schema.node('paragraph', { isAmgBlock: true }, [
                schema.text('hello'),
              ]),
              schema.node('paragraph', { isAmgBlock: true }, [
                schema.text('world'),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should construct a list followed by a paragraph in a blockquote', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: 'paragraph',
            parents: [
              new automerge.RawString('blockquote'),
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
          },
        },
        { type: 'text', value: 'some quote' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [new automerge.RawString('blockquote')],
            attrs: {},
          },
        },
        { type: 'text', value: 'more quote' },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('blockquote', null, [
              schema.node('bullet_list', null, [
                schema.node('list_item', null, [
                  schema.node('paragraph', { isAmgBlock: true }, [
                    schema.text('some quote'),
                  ]),
                ]),
              ]),
              schema.node('paragraph', { isAmgBlock: true }, [
                schema.text('more quote'),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should construct a nested list following a paragraph', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello world' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item one' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('bullet_list'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
      ];

      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      assert(
        doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('hello world'),
            ]),
            schema.node('bullet_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', { isAmgBlock: true }, [
                  schema.text('item one'),
                ]),
                schema.node('bullet_list', null, [
                  schema.node('list_item', { isAmgBlock: true }, [
                    schema.node('paragraph', null, []),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ),
      );
    });

    describe('when handling unknown blocks', () => {
      Deno.test('should render them as the unknown block type', () => {
        const spans: automerge.Span[] = [
          {
            type: 'block',
            value: {
              type: new automerge.RawString('unknown'),
              parents: [],
              attrs: {},
            },
          },
          { type: 'text', value: 'hello' },
        ];
        const doc = amSpansToDoc(basicSchemaAdapter, spans);
        assert(
          doc.eq(
            schema.node('doc', null, [
              schema.node(
                'unknownBlock',
                {
                  isAmgBlock: true,
                  unknownBlock: {
                    type: 'unknown',
                    parents: [],
                    attrs: {},
                    isEmbed: false,
                  },
                },
                [schema.node('paragraph', null, [schema.text('hello')])],
              ),
            ]),
          ),
        );
      });

      Deno.test('should render nested blocks using the unknown block type', () => {
        const spans: automerge.Span[] = [
          {
            type: 'block',
            value: {
              type: new automerge.RawString('unknown'),
              parents: [new automerge.RawString('unknown')],
              attrs: {},
            },
          },
          { type: 'text', value: 'hello' },
        ];
        const doc = amSpansToDoc(basicSchemaAdapter, spans);
        const expected = schema.node('doc', null, [
          schema.node('unknownBlock', { unknownParentBlock: 'unknown' }, [
            schema.node(
              'unknownBlock',
              {
                isAmgBlock: true,
                unknownBlock: {
                  type: 'unknown',
                  parents: ['unknown'],
                  attrs: {},
                  isEmbed: false,
                },
              },
              [schema.node('paragraph', null, [schema.text('hello')])],
            ),
          ]),
        ]);
        assert(doc.eq(expected));
      });
    });
  });

  describe('the pmNodeToSpans function', () => {
    const schema = basicSchemaAdapter.schema;
    Deno.test('should return the correct blocks for a document with a list containing a paragraph', () => {
      const doc = schema.node('doc', null, [
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
          ]),
          schema.node('list_item', null, [schema.node('paragraph', null, [])]),
        ]),
      ]);
      const blocks = Array.from(pmNodeToSpans(basicSchemaAdapter, doc));
      assertEquals(blocks, [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item 1', marks: {} },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [new automerge.RawString('bullet_list')],
            attrs: {},
            isEmbed: false,
          },
        },
      ]);
    });

    Deno.test('should construct a nested list following a paragraph', () => {
      const doc = schema.node('doc', null, [
        schema.node('paragraph', { isAmgBlock: true }, [
          schema.text('hello world'),
        ]),
        schema.node('bullet_list', null, [
          schema.node('list_item', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item one'),
            ]),
            schema.node('bullet_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ]),
      ]);
      const blocks = Array.from(pmNodeToSpans(basicSchemaAdapter, doc));
      assertEquals(blocks, [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello world', marks: {} },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'item one', marks: {} },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('list_item'),
            parents: [
              new automerge.RawString('bullet_list'),
              new automerge.RawString('list_item'),
              new automerge.RawString('bullet_list'),
            ],
            attrs: {},
            isEmbed: false,
          },
        },
      ]);
    });
  });

  Deno.test('should return an explicit paragraph for the second paragraph in a list item', () => {
    const schema = basicSchemaAdapter.schema;
    const doc = schema.node('doc', null, [
      schema.node('bullet_list', null, [
        schema.node('list_item', null, [
          schema.node('paragraph', { isAmgBlock: true }, [
            schema.text('item 1'),
          ]),
          schema.node('paragraph', null, []),
        ]),
      ]),
    ]);
    const blocks = Array.from(pmNodeToSpans(basicSchemaAdapter, doc));
    assertEquals(blocks, [
      {
        type: 'block',
        value: {
          type: new automerge.RawString('paragraph'),
          parents: [
            new automerge.RawString('bullet_list'),
            new automerge.RawString('list_item'),
          ],
          attrs: {},
          isEmbed: false,
        },
      },
      { type: 'text', value: 'item 1', marks: {} },
      {
        type: 'block',
        value: {
          type: new automerge.RawString('paragraph'),
          parents: [
            new automerge.RawString('bullet_list'),
            new automerge.RawString('list_item'),
          ],
          attrs: {},
          isEmbed: false,
        },
      },
    ]);
  });

  describe('when handling unknown block types', () => {
    Deno.test('should round trip the block type', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('unknown'),
            parents: [],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello', marks: {} },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });

    Deno.test('should round trip the isEmbed state', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('unknown'),
            parents: [],
            attrs: {},
            isEmbed: true,
          },
        },
        { type: 'text', value: 'hello', marks: {} },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });

    Deno.test('should round trip nested unknown blocks', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('unknown'),
            parents: [new automerge.RawString('unknown')],
            attrs: {},
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello', marks: {} },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });
  });

  describe('when handling unknown attributes of known blocks', () => {
    Deno.test('should round trip them through the editor', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {
              foo: 'bar',
            },
            isEmbed: false,
          },
        },
        { type: 'text', value: 'hello', marks: {} },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });

    Deno.test('should round trip unknown attributes of known embed blocks through the editor', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('image'),
            parents: [],
            attrs: {
              src: new automerge.RawString('image.png'),
              alt: null,
              title: null,
            },
            isEmbed: true,
          },
        },
        { type: 'text', value: 'hello', marks: {} },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });
  });

  describe('when handling unknown marks', () => {
    Deno.test('should round trip them through the editor', () => {
      const date = new Date();
      const spans: automerge.Span[] = [
        {
          type: 'text',
          value: 'hello',
          marks: {
            unknownBool: true,
            unknownString: 'hello',
            unknownNumber: 1,
            unknownDate: date,
          },
        },
      ];
      const doc = amSpansToDoc(basicSchemaAdapter, spans);
      const blocks: automerge.Span[] = Array.from(
        pmNodeToSpans(basicSchemaAdapter, doc),
      );
      assertEquals(blocks, spans);
    });
  });
});

function assertTraversalEqual(
  actual: TraversalEvent[],
  expected: TraversalEvent[],
) {
  if (actual.length === expected.length) {
    if (
      actual.every((event, i) => {
        try {
          assertEquals(event, expected[i]);
          return true;
        } catch (e) {
          return false;
        }
      })
    ) {
      return true;
    }
  }

  const expectedEvents = expected.map(printEvent);
  const actualEvents = actual.map(printEvent);

  throw new AssertionError({
    message: "traversals didn't match",
    expected: expectedEvents,
    actual: actualEvents,
  });
}

function printEvent(event: TraversalEvent): string {
  if (event.type === 'openTag') {
    if (event.role === 'explicit') {
      return `<${event.tag} explicit>`;
    }
    return `<${event.tag}>`;
  } else if (event.type === 'closeTag') {
    if (event.role === 'explicit') {
      return `</${event.tag} explicit>`;
    }
    return `</${event.tag}>`;
  } else if (event.type === 'leafNode') {
    return `<${event.tag} />`;
  } else if (event.type === 'text') {
    return `text: ${event.text}`;
  } else if (event.type === 'block') {
    return `block: ${JSON.stringify(event.block)}`;
  } else {
    return 'unknown';
  }
}

export function printIndexTableForSpans(spans: automerge.Span[]): string {
  return printIndexTable(traverseSpans(basicSchemaAdapter, spans));
}

export function printIndexTable(
  events: IterableIterator<TraversalEvent>,
): string {
  let eventColWidth = 'event'.length;
  let amIdxColWidth = 'amIdx'.length;
  let pmIdxColWidth = 'pmIdx'.length;
  const rows = Array.from(eventsWithIndexChanges(events)).map(
    ({ event, after }) => {
      const eventCol = printEvent(event);
      eventColWidth = Math.max(eventColWidth, eventCol.length);
      const amIdxCol = after.amIdx.toString();
      amIdxColWidth = Math.max(amIdxColWidth, amIdxCol.length);
      const pmIdxCol = after.pmIdx.toString();
      pmIdxColWidth = Math.max(pmIdxColWidth, pmIdxCol.length);
      return { eventCol, amIdxCol, pmIdxCol };
    },
  );
  const header = `| ${'event'.padEnd(eventColWidth)} | ${
    'amIdx'.padEnd(amIdxColWidth)
  } | ${'pmIdx'.padEnd(pmIdxColWidth)} |`;
  const divider = `| ${'-'.repeat(eventColWidth)} | ${
    '-'.repeat(amIdxColWidth)
  } | ${'-'.repeat(pmIdxColWidth)} |`;
  const body = rows
    .map(
      (row) =>
        `| ${row.eventCol.padEnd(eventColWidth)} | ${
          row.amIdxCol.padEnd(amIdxColWidth)
        } | ${row.pmIdxCol.padEnd(pmIdxColWidth)} |`,
    )
    .join('\n');
  return `${header}\n${divider}\n${body}`;
}
