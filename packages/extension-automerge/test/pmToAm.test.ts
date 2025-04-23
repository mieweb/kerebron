import { EditorState } from 'prosemirror-state';
import { Fragment, Node, Slice } from 'prosemirror-model';
import { AddMarkStep, ReplaceStep, Step } from 'prosemirror-transform';
import { next as automerge } from '@automerge/automerge';

import { assertEquals } from '@std/assert';

import { assertSplitBlock, describe, makeDoc } from './testUtils.ts';
import { pmToAm } from '../src/pmToAm.ts';
import { amSpansToDoc } from '../src/amTraversal.ts';
import { SchemaAdapter } from '../src/SchemaAdapter.ts';
import { schema } from './basicSchema.ts';

const basicSchemaAdapter = new SchemaAdapter(schema);

function updateDoc(
  amDoc: automerge.Doc<unknown>,
  pmDoc: Node,
  steps: Step[],
): automerge.Patch[] {
  const heads = automerge.getHeads(amDoc);
  const spans = automerge.spans(amDoc, ['text']);
  const updatedDoc = automerge.change(amDoc, (d) => {
    pmToAm(basicSchemaAdapter, spans, steps, d, pmDoc, ['text']);
  });
  return automerge.diff(amDoc, heads, automerge.getHeads(updatedDoc));
}

describe('when converting a ReplaceStep to a change', () => {
  Deno.test('should convert a <li></li> ReplaceStep in a list item to a splitblock', () => {
    const { editor, doc } = makeDoc([
      { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      'item 1',
    ]);
    // am:            0    1  2 3 4  5  6
    //     <doc><ol> <li> <p> i t e m ' ' 1 </p></li></ol></doc>
    // pm:0     0   1    2   3 4 5 6 7   8 9   10   11   12     13
    const diff = updateDoc(doc, editor.doc, [
      new ReplaceStep(
        9,
        9,
        new Slice(
          Fragment.from([
            schema.node('list_item', null, [
              schema.node('paragraph', null, []),
            ]),
            schema.node('list_item', null, [
              schema.node('paragraph', null, []),
            ]),
          ]),
          2,
          2,
        ),
      ),
    ]);
    assertSplitBlock(diff, ['text', 7], {
      type: 'list_item',
      parents: ['ordered_list'],
      attrs: {},
      isEmbed: false,
    });
  });

  Deno.test('should emit a splitBlock for a ReplaceStep at the end of a list item', () => {
    const { editor, doc } = makeDoc([
      { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      'item 1',
    ]);
    const diff = updateDoc(doc, editor.doc, [
      new ReplaceStep(
        11,
        11,
        new Slice(
          Fragment.from(
            schema.node('list_item', { isAmgBlock: false }, [
              schema.node('paragraph', null, []),
            ]),
          ),
          0,
          0,
        ),
      ),
    ]);
    assertSplitBlock(diff, ['text', 7], {
      type: 'list_item',
      parents: ['ordered_list'],
      attrs: {},
      isEmbed: false,
    });
  });

  Deno.test('should emit a splitBlock for a ReplaceStep at the end of a list item containing an explicit paragraph', () => {
    const { editor, doc } = makeDoc([
      { type: 'paragraph', parents: ['ordered_list', 'list_item'], attrs: {} },
      'item 1',
    ]);
    const diff = updateDoc(doc, editor.doc, [
      new ReplaceStep(
        9,
        9,
        new Slice(
          Fragment.from([
            schema.node('paragraph', null, []),
            schema.node('paragraph', null, []),
          ]),
          1,
          1,
        ),
      ),
    ]);
    assertSplitBlock(diff, ['text', 7], {
      type: 'paragraph',
      parents: ['ordered_list', 'list_item'],
      attrs: {},
      isEmbed: false,
    });
  });

  Deno.test('should emit a splitBlock when a ReplaceStep inserts a list element', () => {
    const { editor, doc } = makeDoc([
      { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      'item 1',
    ]);
    //am:              0       1 2 3 4  5  6
    //     <doc> <ol> <li> <p> i t e m ' ' 1 </p> </li> </ol> </doc>
    //pm: 0     0    1    2   3 4 5 6 7   8 9   10     11    12     13
    const diff = updateDoc(doc, editor.doc, [
      new ReplaceStep(
        11,
        11,
        new Slice(
          Fragment.from(
            schema.node('list_item', { isAmgBlock: false }, [
              schema.node('paragraph', null, []),
            ]),
          ),
          0,
          0,
        ),
      ),
    ]);
    assertSplitBlock(diff, ['text', 7], {
      type: 'list_item',
      parents: ['ordered_list'],
      attrs: {},
      isEmbed: false,
    });
  });

  Deno.test('should add a mark if the replace step does not match the text at the insertion point', () => {
    const { editor, doc } = makeDoc(['item ']);
    updateDoc(doc, editor.doc, [
      new ReplaceStep(
        6,
        6,
        new Slice(
          Fragment.from(schema.text('1', [schema.marks.strong.create()])),
          0,
          0,
        ),
      ),
    ]);
    const marks = automerge.marks(doc, ['text']);
    assertEquals(marks, [
      { start: 5, end: 6, name: 'strong', value: true },
    ]);
  });

  Deno.test('should add link marks with serialized attributes', () => {
    const { editor, doc } = makeDoc(['item ']);
    updateDoc(doc, editor.doc, [
      new ReplaceStep(
        6,
        6,
        new Slice(
          Fragment.from(
            schema.text('1', [
              schema.marks.link.create({ href: 'http://example.com' }),
            ]),
          ),
          0,
          0,
        ),
      ),
    ]);
    const marks = automerge.marks(doc, ['text']);
    assertEquals(marks, [
      {
        start: 5,
        end: 6,
        name: 'link',
        value: JSON.stringify({ href: 'http://example.com', title: null }),
      },
    ]);
  });

  Deno.test('should preserve unknown marks', () => {
    let doc = automerge.from({ text: 'hello world' });
    doc = automerge.change(doc, (d) => {
      automerge.mark(
        d,
        ['text'],
        { start: 3, end: 6, expand: 'both' },
        'specialMark',
        true,
      );
    });
    const spans = automerge.spans(doc, ['text']);
    const pmDoc = amSpansToDoc(basicSchemaAdapter, spans);
    const editor = EditorState.create({ schema, doc: pmDoc });
    updateDoc(doc, editor.doc, [
      new ReplaceStep(
        6,
        6,
        new Slice(
          Fragment.from(schema.text('1', [schema.marks.strong.create()])),
          0,
          0,
        ),
      ),
    ]);
    const marks = automerge.marks(doc, ['text']);
    const marksByType: { [key: string]: automerge.Mark[] } = {};
    for (const mark of marks) {
      if (!marksByType[mark.name]) {
        marksByType[mark.name] = [];
      }
      marksByType[mark.name].push(mark);
    }
    assertEquals(marksByType, {
      specialMark: [{ start: 3, end: 7, name: 'specialMark', value: true }],
      strong: [{ start: 5, end: 6, name: 'strong', value: true }],
    });
  });
});

describe('when converting addMark steps to a change', () => {
  Deno.test('should consolidate consecutive addMark steps', () => {
    const { editor, doc } = makeDoc([
      { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      'item 1',
      { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      'item 2',
    ]);
    // Add marks across the text of the two list items
    updateDoc(doc, editor.doc, [
      new AddMarkStep(3, 9, editor.schema.marks.strong.create()),
      new AddMarkStep(13, 19, editor.schema.marks.strong.create()),
    ]);
    const marks = automerge.marks(doc, ['text']);
    assertEquals(marks, [
      { start: 1, end: 14, name: 'strong', value: true },
    ]);
  });
});
