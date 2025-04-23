import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeUnknownBlock extends Node {
  override name = 'unknownBlock';
  requires = ['doc'];

  automerge = {
    unknownBlock: true,
  };

  override getNodeSpec(): NodeSpec {
    return {
      group: 'block',
      content: 'block+',
      parseDOM: [{ tag: 'div', attrs: { 'data-unknown-block': 'true' } }],
      toDOM() {
        return ['div', { 'data-unknown-block': 'true' }, 0];
      },
    };
  }
}
