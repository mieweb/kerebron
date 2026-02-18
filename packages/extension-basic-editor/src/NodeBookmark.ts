import { NodeSpec } from 'prosemirror-model';

import { NESTING_SELF_CLOSING, Node } from '@kerebron/editor';

export class NodeBookmark extends Node {
  override name = 'node_bookmark';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: false,
      atom: true,
      attrs: {
        id: {},
        nesting: {
          default: NESTING_SELF_CLOSING,
        },
      },
      parseDOM: [],
      toDOM(mark) {
        return ['a', { id: mark.attrs.id }, 0];
      },
    };
  }
}
