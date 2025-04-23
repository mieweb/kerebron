import { EditorState } from 'prosemirror-state';
import { next as automerge } from '@automerge/automerge';

import { assert, assertEquals } from '@std/assert';

import { amToPm } from '../src/amToPm.ts';
import {
  BlockDef,
  describe,
  makeDoc,
  splitBlock,
  updateBlockType,
} from './testUtils.ts';
import { schema } from './basicSchema.ts';
import { SchemaAdapter } from '../src/SchemaAdapter.ts';

const basicSchemaAdapter = new SchemaAdapter(schema);

type PerformPatchArgs = {
  initialDoc: (string | BlockDef)[];
  patches: (((_: automerge.Prop[]) => automerge.Patch[]) | automerge.Patch)[];
  isLocal?: boolean;
};

function performPatch({
  initialDoc,
  patches,
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  isLocal,
}: PerformPatchArgs): EditorState {
  const { editor, spans } = makeDoc(initialDoc);
  const amPatches: automerge.Patch[] = [];
  for (const patchOrFactory of patches) {
    if (typeof patchOrFactory === 'function') {
      amPatches.push(...patchOrFactory(['text']));
    } else {
      amPatches.push(patchOrFactory);
    }
  }
  const tx = amToPm(basicSchemaAdapter, spans, amPatches, ['text'], editor.tr);
  return editor.apply(tx);
}

describe('the amToPm function', () => {
  describe('when handling splice', () => {
    Deno.test('should insert characters in the top level text when splicing', () => {
      const patched = performPatch({
        initialDoc: ['world'],
        patches: [
          {
            action: 'splice',
            path: ['text', 0],
            value: 'hello ',
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: false }, [
              schema.text('hello world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should correctly insert characters at the end of a list item', () => {
      const patched = performPatch({
        initialDoc: [
          {
            type: 'list_item',
            parents: ['bullet_list', 'list_item', 'ordered_list'],
            attrs: {},
          },
          'item 1',
        ],
        patches: [
          {
            action: 'splice',
            path: ['text', 7],
            value: '1',
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('bullet_list', null, [
              schema.node('list_item', null, [
                schema.node('paragraph', null, []),
                schema.node('ordered_list', null, [
                  schema.node('list_item', { isAmgBlock: true }, [
                    schema.node('paragraph', null, [schema.text('item 11')]),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should add marks to inserted characters', () => {
      const patched = performPatch({
        initialDoc: ['world'],
        patches: [
          {
            action: 'splice',
            path: ['text', 2],
            value: 'o',
            marks: { strong: true },
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: false }, [
              schema.text('wo', []),
              schema.text('o', [schema.mark('strong')]),
              schema.text('rld', []),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should update the selection to be just after the character inserted when local', () => {
      const patched = performPatch({
        initialDoc: [{ type: 'paragraph', parents: [], attrs: {} }, 'item'],
        patches: [
          {
            action: 'splice',
            path: ['text', 1],
            value: 'i',
          },
          {
            action: 'splice',
            path: ['text', 2],
            value: 'i',
          },
          {
            action: 'splice',
            path: ['text', 3],
            value: 'i',
          },
        ],
        isLocal: true,
      });
      // afterwards
      //   <p> i i i i t e m </p>
      // 0    1 2 3 4 5 6 7 8    9
      assertEquals(patched.selection.from, 4);
      assertEquals(patched.selection.to, 4);
    });

    Deno.test('should calculate the correct index when deleting the first block', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'heading', parents: [], attrs: { level: 1 } },
          'Untitled',
        ],
        patches: [
          {
            action: 'del',
            path: ['text', 1],
            length: 8,
          },
          {
            action: 'splice',
            path: ['text', 1],
            value: 'a',
          },
        ],
      }).doc;
      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('heading', { isAmgBlock: true }, [
              schema.text('a', []),
            ]),
          ]),
        ),
      );
    });
  });

  describe('when handling mark', () => {
    Deno.test('should add marks to existing text', () => {
      const patched = performPatch({
        initialDoc: ['world'],
        patches: [
          {
            action: 'mark',
            path: ['text'],
            marks: [{ name: 'strong', value: true, start: 1, end: 3 }],
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: false }, [
              schema.text('w', []),
              schema.text('or', [schema.mark('strong')]),
              schema.text('ld', []),
            ]),
          ]),
        ),
      );
    });
  });

  describe('when handling splitBlock', () => {
    Deno.test('should insert new paragraphs at the top level', () => {
      const patched = performPatch({
        initialDoc: ['hello world'],
        patches: [splitBlock(6, { type: 'paragraph', parents: [], attrs: {} })],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: false }, [
              schema.text('hello '),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should convert a top level inferred para to explicit if a splitblock arrives at the top level', () => {
      const patched = performPatch({
        initialDoc: ['hello world'],
        patches: [splitBlock(0, { type: 'paragraph', parents: [], attrs: {} })],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('hello world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should insert a second paragraph after converting the inferred top level para to explicit', () => {
      const patched = performPatch({
        initialDoc: ['hello world'],
        patches: [
          splitBlock(0, { type: 'paragraph', parents: [], attrs: {} }),
          splitBlock(1, { type: 'paragraph', parents: [], attrs: {} }),
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, []),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('hello world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should insert new list items at the top level', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item 1',
        ],
        patches: [
          splitBlock(7, {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
          }),
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 1')]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should insert new list items after existing list items', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'paragraph', parents: [], attrs: {} },
          'item 1',
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item 2',
        ],
        patches: [
          splitBlock(14, {
            type: 'list_item',
            parents: ['ordered_list'],
            attrs: {},
          }),
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 2')]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, []),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should add a paragraph inside a list item', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'paragraph', parents: [], attrs: {} },
          'item 1',
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item 2',
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        ],
        patches: [
          splitBlock(15, {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
          }),
        ],
      });

      assert(
        patched.doc.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item 1'),
            ]),
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item 2')]),
              ]),
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', { isAmgBlock: true }, []),
              ]),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should split the text in a paragraph', () => {
      const patched = performPatch({
        initialDoc: [{ type: 'paragraph', parents: [], attrs: {} }, 'item 1'],
        patches: [splitBlock(4, { type: 'paragraph', parents: [], attrs: {} })],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('ite'),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('m 1'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should correctly handle a splitblock which is separated by a text insert', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'heading', parents: [], attrs: { level: 1 } },
          'Heading',
          { type: 'paragraph', parents: [], attrs: {} },
          'some text',
          { type: 'paragraph', parents: [], attrs: {} },
          'b',
        ],
        patches: [
          {
            action: 'insert',
            path: ['text', 20],
            values: [{}],
          },
          {
            action: 'splice',
            path: ['text', 21],
            value: 'a',
          },
          {
            action: 'put',
            path: ['text', 20, 'attrs'],
            value: {},
          },
          {
            action: 'put',
            path: ['text', 20, 'type'],
            value: 'paragraph',
          },
          {
            action: 'put',
            path: ['text', 20, 'parents'],
            value: [],
          },
        ],
      });

      // am:        0        1 2 3 4 5 6 7             8          9  10 11 12 13  14 15 16 17              18         19
      //     <doc> <heading> H e a d i n g </heading> <paragraph> s  o  m  e  ' ' t  e  x  t </paragraph> <paragraph> b </paragraph> <paragraph> </paragraph> </doc>
      // pm: 0              1 2 3 4 5 6 7 8          9          10 11 12 13 14  15 16 17 18 19          20          21 22          23           24           25

      assert(
        patched.doc.eq(
          schema.node('doc', null, [
            schema.node('heading', { isAmgBlock: true }, [
              schema.text('Heading'),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('some text'),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [schema.text('b')]),
            schema.node('paragraph', { isAmgBlock: true }, [schema.text('a')]),
          ]),
        ),
      );
    });
  });

  describe('when handling delete', () => {
    Deno.test('should delete characters at the end of the text', () => {
      const patched = performPatch({
        initialDoc: ['hello world'],
        patches: [
          {
            action: 'del',
            path: ['text', 10],
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: false }, [
              schema.text('hello worl'),
            ]),
          ]),
        ),
      );
    });
  });

  describe('when handling joinBlock', () => {
    Deno.test('should merge the text of two sibling paragraphs into one', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'paragraph', parents: [], attrs: {} },
          'hello ',
          { type: 'paragraph', parents: [], attrs: {} },
          'world',
        ],
        patches: [
          {
            action: 'del',
            path: ['text', 7],
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('hello world'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should handle deletion of a range, followed by a deleted block, followed by a deletion', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'paragraph', parents: [], attrs: {} },
          'line one',
          { type: 'paragraph', parents: [], attrs: {} },
          'line two',
          { type: 'paragraph', parents: [], attrs: {} },
          'line three',
        ],
        patches: [
          {
            action: 'del',
            path: ['text', 6],
            length: 3,
          },
          {
            action: 'del',
            path: ['text', 6],
          },
          {
            action: 'del',
            path: ['text', 6],
            length: 5,
          },
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('line two'),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('line three'),
            ]),
          ]),
        ),
      );
    });
  });

  describe('when handling updateBlock', () => {
    Deno.test('should convert a sole list item into a paragraph', () => {
      const patched = performPatch({
        initialDoc: [
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item one',
        ],
        patches: [
          updateBlockType(0, 'paragraph'),
        ],
      }).doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item one'),
            ]),
          ]),
        ),
      );
    });

    return;

    Deno.test('should convert the last item in a multi item list into a paragraph', () => {
      // TUTI
      const patched = performPatch({
        initialDoc: [
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item one',
          { type: 'list_item', parents: ['ordered_list'], attrs: {} },
          'item two',
        ],
        // patches: [],
        patches: [updateBlockType(12, 'paragraph')],
      }).doc;

      //
      //am:0     1   2       3 4 5 6 7   8  9  10 11  12   13  14 15 16 17 18 19 20 21 22 23  24   25   26   27     28
      //    <doc><ol><li><p> i t e m ' ' o  n  e  </p></li><li><p> i  t  e  m ' ' t  w  o </p></li></ol></doc>
      //pm:0     1   2      3 4 5 6 7   8  9  10 11  12   13  14 15 16 17 18 19 20 21 22 23  24   25   26   27     28
      //pm:0         1   2  3 4 5 6 7   8  9  10 11  12   13  14 15 16 17 18 19 20 21 22 23  24   25   26   27     28
      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item one')]),
              ]),
            ]),
            schema.node('paragraph', { isAmgBlock: true }, [
              schema.text('item two'),
            ]),
          ]),
        ),
      );
    });

    Deno.test('should convert a sole paragraph into a list item', () => {
      const result = performPatch({
        initialDoc: [{ type: 'paragraph', parents: [], attrs: {} }, 'item one'],
        patches: [
          updateBlockType(0, 'list_item'),
          // updateBlockType(0, 'ordered_list'),
          // {
          //   action: 'put',
          //   path: path.concat([index, 'type']),
          //   value: new automerge.RawString(newType),
          // },
          {
            action: 'put',
            path: ['text', 0],
            value: 'ordered_list',
          },
        ],
      });

      const patched = result.doc;

      assert(
        patched.eq(
          schema.node('doc', null, [
            schema.node('ordered_list', null, [
              schema.node('list_item', { isAmgBlock: true }, [
                schema.node('paragraph', null, [schema.text('item one')]),
              ]),
            ]),
          ]),
        ),
      );
    });
  });
});
