import type { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeSoftBreak extends Node {
  override name = 'softbreak';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'wbr' }],
      toDOM() {
        return ['wbr'];
      },
    };
  }
}
