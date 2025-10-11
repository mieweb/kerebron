import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeDefinitionTerm extends Node {
  override name = 'dt';
  requires = ['dl'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'dt' }],
      defining: true,
      toDOM() {
        return ['dt', 0];
      },
    };
  }
}
