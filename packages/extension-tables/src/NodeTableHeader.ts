import type { Attrs, Node as PmNode, NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

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

export class NodeTableHeader extends Node {
  override name = 'table_header';
  requires = ['table'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [
        { tag: 'th', getAttrs: (dom) => getCellAttrs(dom) },
      ],
      toDOM: (node) => ['th', setCellAttrs(node), 0],
    };
  }
}
