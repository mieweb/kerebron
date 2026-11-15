import { TextSelection } from 'prosemirror-state';
import { NodeSpec, NodeType } from 'prosemirror-model';
import { Node as ProseMirrorNode } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  getHtmlAttributes,
  setHtmlAttributes,
} from '@kerebron/editor/utilities';

import { createTable } from './utilities/createTable.ts';
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

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /** Insert a column after the current cell selection. */
    addColumnAfter: () => ReturnType;
    /** Insert a column before the current cell selection. */
    addColumnBefore: () => ReturnType;
    /** Insert a row after the current cell selection. */
    addRowAfter: () => ReturnType;
    /** Insert a row before the current cell selection. */
    addRowBefore: () => ReturnType;
    /** Delete the selected column(s). */
    deleteColumn: () => ReturnType;
    /** Delete the selected row(s). */
    deleteRow: () => ReturnType;
    /** Delete the entire table. */
    deleteTable: () => ReturnType;
    /** Merge the selected cells. */
    mergeCells: () => ReturnType;
    /** Split the currently selected merged cell. */
    splitCell: () => ReturnType;
    /** Toggle header status of the selected cell(s). */
    toggleHeaderCell: () => ReturnType;
    /** Toggle header status of the selected row(s). */
    toggleHeaderRow: () => ReturnType;
    /** Toggle header status of the selected column(s). */
    toggleHeaderColumn: () => ReturnType;
    /**
     * Move the cursor to the next or previous cell.
     *
     * @param direction `1` for next, `-1` for previous.
     */
    goToNextCell: (direction: -1 | 1) => ReturnType;
    /**
     * Set an attribute on the selected cell(s).
     *
     * @param name Attribute name, e.g. `colspan`.
     * @param value Attribute value.
     */
    setCellAttr: (name: string, value: unknown) => ReturnType;
    /**
     * Toggle header state for a table part.
     *
     * @param type Which part to toggle.
     * @param options `useDeprecatedLogic` selects the legacy behavior.
     */
    toggleHeader: (
      type: 'column' | 'row' | 'cell',
      options?: { useDeprecatedLogic: boolean },
    ) => ReturnType;
    /**
     * Insert a table at the current selection.
     *
     * @param rows Row count.
     * @param cols Column count.
     * @param withHeaderRow Whether the first row is a header row.
     */
    insertTable: (
      options?: { rows?: number; cols?: number; withHeaderRow?: boolean },
    ) => ReturnType;
    /**
     * Set a cell selection from anchor/head positions.
     *
     * @param position Positions with `anchorCell` and `headCell`.
     */
    setCellSelection: (position: {
      anchorCell: number;
      headCell: number;
    }) => ReturnType;
  }
}

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

  override getProseMirrorPlugins(): Plugin[] {
    return [
      columnResizing(),
      tableEditing(),
    ];
  }
}
