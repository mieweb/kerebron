import { Attrs, Node as PmNode, NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { type InputRule } from '@kerebron/editor/plugins/input-rules';

function getCellAttrs(dom: HTMLElement | string): Attrs {
  if (typeof dom === 'string') {
    return {};
  }

  const widthAttr = dom.getAttribute('data-colwidth');
  const widths = widthAttr && /^\d+(,\d+)*$/.test(widthAttr)
    ? widthAttr.split(',').map((s) => Number(s))
    : null;
  const colspan = Number(dom.getAttribute('colspan') || 1);
  return {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth: widths && widths.length == colspan ? widths : null,
  };
}

function setCellAttrs(node: PmNode): Attrs {
  return {
    colspan: (node.attrs.colspan != 1) ? node.attrs.colspan : undefined,
    rowspan: (node.attrs.rowspan != 1) ? node.attrs.rowspan : undefined,
    'data-colwidth': node.attrs.colwidth?.join(','),
  };
}

export class NodeTableCell extends Node {
  override name = 'table_cell';
  requires = ['table_row'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'cell',
      isolating: true,
      parseDOM: [
        { tag: 'td', getAttrs: (dom) => getCellAttrs(dom) },
      ],
      toDOM(node) {
        return ['td', setCellAttrs(node), 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const commands = {};
    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const keys = {};
    return keys;
  }
}
