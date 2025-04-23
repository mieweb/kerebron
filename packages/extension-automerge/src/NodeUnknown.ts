import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeUnknown extends Node {
  override name = 'unknownLeaf';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      attrs: { isAmgBlock: { default: true }, unknownBlock: { default: null } },
      group: 'inline',
      toDOM() {
        return document.createTextNode('u{fffc}');
      },
    };
  }
}
