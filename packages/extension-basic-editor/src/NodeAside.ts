import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeAside extends Node {
  override name = 'aside';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'aside' }],
      toDOM() {
        return ['aside', 0];
      },
    };
  }
}
