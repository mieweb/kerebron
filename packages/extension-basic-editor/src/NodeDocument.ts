import { NodeSpec, SchemaSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeDocument extends Node {
  override name = 'doc';

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      EMPTY_DOC: {
        'type': this.name,
        'content': [
          {
            'type': 'paragraph',
            'content': [],
          },
        ],
      },
    };
  }
}
