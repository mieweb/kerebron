import { assertEquals } from '@std/assert';
import type { Node as PMNode, NodeSpec, NodeType } from 'prosemirror-model';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection, Transaction } from 'prosemirror-state';

import { NodeCodeCrock } from '@kerebron/extension-codecrock/NodeCodeCrock';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';
import { NodeTable } from '@kerebron/extension-tables/NodeTable';
import { NodeTableRow } from '@kerebron/extension-tables/NodeTableRow';
import { NodeTableCell } from '@kerebron/extension-tables/NodeTableCell';
import { NodeTableHeader } from '@kerebron/extension-tables/NodeTableHeader';
import { NodeHardBreak } from '@kerebron/extension-basic-editor/NodeHardBreak';
import { NodeHorizontalRule } from '@kerebron/extension-basic-editor/NodeHorizontalRule';
import { NodeImage } from '@kerebron/extension-basic-editor/NodeImage';
import { NodeBlockquote } from '@kerebron/extension-basic-editor/NodeBlockquote';
import { NodeBulletList } from '@kerebron/extension-basic-editor/NodeBulletList';
import { NodeListItem } from '@kerebron/extension-basic-editor/NodeListItem';
import { NodeDefinitionList } from '@kerebron/extension-basic-editor/NodeDefinitionList';
import { NodeDefinitionTerm } from '@kerebron/extension-basic-editor/NodeDefinitionTerm';
import { NodeDefinitionDesc } from '@kerebron/extension-basic-editor/NodeDefinitionDesc';
import { CellSelection } from '@kerebron/extension-tables/CellSelection';
import { TableMap } from '@kerebron/extension-tables/TableMap';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    text: {},
    code_block: new NodeCodeBlock().getNodeSpec() as NodeSpec,
    hard_break: new NodeHardBreak().getNodeSpec() as NodeSpec,
    hr: new NodeHorizontalRule().getNodeSpec() as NodeSpec,
    image: new NodeImage().getNodeSpec() as NodeSpec,
    blockquote: new NodeBlockquote().getNodeSpec() as NodeSpec,
    dl: new NodeDefinitionList().getNodeSpec() as NodeSpec,
    dt: new NodeDefinitionTerm().getNodeSpec() as NodeSpec,
    dd: new NodeDefinitionDesc().getNodeSpec() as NodeSpec,
    bullet_list: new NodeBulletList().getNodeSpec() as NodeSpec,
    list_item: new NodeListItem().getNodeSpec() as NodeSpec,
    table: new NodeTable().getNodeSpec() as NodeSpec,
    table_row: new NodeTableRow().getNodeSpec() as NodeSpec,
    table_cell: new NodeTableCell().getNodeSpec() as NodeSpec,
    table_header: new NodeTableHeader().getNodeSpec() as NodeSpec,
  },
  marks: {},
});

function makeSetCodeBlock(type: NodeType) {
  const extension = new NodeCodeCrock({});
  const factories = extension.getCommandFactories(
    {} as Parameters<typeof extension.getCommandFactories>[0],
    type,
  );
  if (!factories['setCodeBlock']) throw new Error('factory missing');
  return factories['setCodeBlock'];
}

function runCommand(
  command: ReturnType<ReturnType<typeof makeSetCodeBlock>>,
  state: EditorState,
): EditorState {
  const transactions: Transaction[] = [];
  const ok = command(state, (tr) => transactions.push(tr));
  assertEquals(ok, true);
  assertEquals(transactions.length, 1);
  return state.apply(transactions[0]);
}

function cellWith(...paragraphTexts: string[]): PMNode {
  const { table_cell, paragraph } = schema.nodes;
  return table_cell.create(
    null,
    paragraphTexts.map((t) => paragraph.create(null, schema.text(t))),
  );
}

function children(node: PMNode): PMNode[] {
  const out: PMNode[] = [];
  node.forEach((child) => out.push(child));
  return out;
}

Deno.test('setCodeBlock converts every cell of a CellSelection', () => {
  const { doc, table, table_row, code_block } = schema.nodes;
  const row = table_row.create(null, [
    cellWith('a', 'b'),
    cellWith('c', 'd'),
    cellWith('e', 'f'),
  ]);
  const document = doc.create(null, table.create(null, row));

  // Select all three cells; the head cell is the last one so that it
  // becomes the primary range of the CellSelection.
  const map = TableMap.get(document.firstChild!);
  const tableStart = 1;
  const selection = CellSelection.create(
    document,
    tableStart + map.map[0],
    tableStart + map.map[2],
  );
  assertEquals(selection.ranges.length, 3);
  const state = EditorState.create({ doc: document, selection });

  const newState = runCommand(makeSetCodeBlock(code_block)('js'), state);

  const cells = children(newState.doc.firstChild!.firstChild!);
  assertEquals(cells.length, 3);
  const texts = cells.map((cell) => cell.firstChild!.textContent);
  assertEquals(texts, ['a\nb', 'c\nd', 'e\nf']);
  for (const cell of cells) {
    assertEquals(cell.childCount, 1);
    assertEquals(cell.firstChild!.type.name, 'code_block');
    assertEquals(cell.firstChild!.attrs.lang, 'js');
  }
  const ids = cells.map((cell) => cell.firstChild!.attrs.id);
  assertEquals(new Set(ids).size, 3, 'each cell gets its own code block');
});

Deno.test('setCodeBlock skips empty cells in a CellSelection', () => {
  const { doc, table, table_row, code_block, table_cell, paragraph } =
    schema.nodes;
  const row = table_row.create(null, [
    cellWith('a', 'b'),
    table_cell.create(null, paragraph.create()),
  ]);
  const document = doc.create(null, table.create(null, row));

  const map = TableMap.get(document.firstChild!);
  const tableStart = 1;
  const selection = CellSelection.create(
    document,
    tableStart + map.map[0],
    tableStart + map.map[1],
  );
  const state = EditorState.create({ doc: document, selection });

  const newState = runCommand(makeSetCodeBlock(code_block)('js'), state);

  const cells = children(newState.doc.firstChild!.firstChild!);
  assertEquals(cells[0].firstChild!.type.name, 'code_block');
  assertEquals(cells[0].firstChild!.textContent, 'a\nb');
  // The empty paragraph is itself a textblock, so it converts into an
  // empty code block (same as the base setBlockType command).
  assertEquals(cells[1].firstChild!.type.name, 'code_block');
  assertEquals(cells[1].firstChild!.textContent, '');
});

Deno.test('setCodeBlock merges a multi-paragraph TextSelection into one block', () => {
  const { doc, paragraph, text, code_block } = schema.nodes;
  const document = doc.create(
    null,
    ['foo', 'bar', 'baz'].map((t) => paragraph.create(null, schema.text(t))),
  );
  const state = EditorState.create({
    doc: document,
    selection: TextSelection.create(document, 1, document.content.size - 1),
  });

  const newState = runCommand(makeSetCodeBlock(code_block)('js'), state);

  assertEquals(newState.doc.childCount, 1);
  assertEquals(newState.doc.firstChild!.type.name, 'code_block');
  assertEquals(newState.doc.firstChild!.textContent, 'foo\nbar\nbaz');
});
