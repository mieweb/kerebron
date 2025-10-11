import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeDefinitionDesc extends Node {
  override name = 'dd';
  requires = ['dl'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'dd' }],
      defining: true,
      toDOM() {
        return ['dd', 0];
      },
    };
  }
}
