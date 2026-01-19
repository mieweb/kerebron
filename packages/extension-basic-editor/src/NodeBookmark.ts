import { NodeSpec } from 'prosemirror-model';

import { Node } from '@kerebron/editor';

export class NodeBookmark extends Node {
  override name = 'node_bookmark';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: false,
      attrs: {
        id: {},
      },
      parseDOM: [],
      toDOM(mark) {
        return ['a', { id: mark.attrs.id }, 0];
      },
    };
  }
}
