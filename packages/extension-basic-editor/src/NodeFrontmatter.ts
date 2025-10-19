import { NodeSpec, NodeType } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeFrontmatter extends Node {
  override name = 'frontmatter';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'pre' }],
      toDOM() {
        return ['pre', 0];
      },
    };
  }
}
