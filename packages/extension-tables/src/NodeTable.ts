import { TextSelection } from 'prosemirror-state';
import { NodeSpec, NodeType } from 'prosemirror-model';
import { Node as ProseMirrorNode } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { type InputRule } from '@kerebron/editor/plugins/input-rules';
import {
  getHtmlAttributes,
  setHtmlAttributes,
} from '@kerebron/editor/utilities';

import { createTable } from './utilities/createTable.ts';
import { fixTables } from './utilities/fixTables.ts';
import { CellSelection } from './utilities/CellSelection.ts';
import { columnResizing } from './utilities/columnResizing.ts';
import { tableEditing } from './utilities/tableEditing.ts';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  mergeCells,
  setCellAttr,
  splitCell,
  toggleHeader,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow,
} from './utilities/commands.ts';
import { Plugin } from 'prosemirror-state';
import { Direction } from './utilities/input.ts';

export class NodeTable extends Node {
  override name = 'table';
  requires = ['doc'];

  override attributes = {
    class: {
      default: 'table',
      fromDom(element: HTMLElement) {
        return element.hasAttribute('class')
          ? element.getAttribute('class')!
          : undefined;
      },
    },
  };

  override getNodeSpec(): NodeSpec {
    return {
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      group: 'block',
      parseDOM: [{
        tag: 'table',
        getAttrs: (element) => setHtmlAttributes(this, element),
      }],
      toDOM: (
        node: ProseMirrorNode,
      ) => ['table', getHtmlAttributes(this, node), ['tbody', 0]],
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [];
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const commands: Partial<CommandFactories> = {
      addColumnAfter: () => (state, dispatch) =>
        addColumnAfter(state, dispatch),
      addColumnBefore: () => (state, dispatch) =>
        addColumnBefore(state, dispatch),
      addRowAfter: () => (state, dispatch) => addRowAfter(state, dispatch),
      addRowBefore: () => (state, dispatch) => addRowBefore(state, dispatch),
      deleteColumn: () => (state, dispatch) => deleteColumn(state, dispatch),
      deleteRow: () => (state, dispatch) => deleteRow(state, dispatch),
      deleteTable: () => (state, dispatch) => deleteTable(state, dispatch),
      goToNextCell: (direction: Direction) => goToNextCell(direction),
      mergeCells: () => (state, dispatch) => mergeCells(state, dispatch),
      setCellAttr: (...args) => setCellAttr(...args),
      splitCell: () => (state, dispatch) => splitCell(state, dispatch),
      toggleHeader: (...args) => toggleHeader(...args),
      toggleHeaderCell: () => (state, dispatch) =>
        toggleHeaderCell(state, dispatch),
      toggleHeaderRow: () => (state, dispatch) =>
        toggleHeaderRow(state, dispatch),
      toggleHeaderColumn: () => (state, dispatch) =>
        toggleHeaderColumn(state, dispatch),
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        (state, dispatch) => {
          const tr = state.tr;
          const node = createTable(editor.schema, rows, cols, withHeaderRow);

          if (dispatch) {
            const offset = tr.selection.from + 1;

            tr.replaceSelectionWith(node)
              .scrollIntoView()
              .setSelection(TextSelection.near(tr.doc.resolve(offset)));
          }

          return true;
        },
      setCellSelection: (position) => (state, dispatch) => {
        if (dispatch) {
          const selection = CellSelection.create(
            state.doc,
            position.anchorCell,
            position.headCell,
          );

          state.tr.setSelection(selection);
        }
        return true;
      },
    };
    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const keys = {};
    return keys;
  }

  override getProseMirrorPlugins(editor: CoreEditor): Plugin[] {
    return [
      columnResizing(),
      tableEditing(),
    ];
  }
}
