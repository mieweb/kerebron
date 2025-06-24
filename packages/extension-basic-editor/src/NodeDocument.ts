import { NodeSpec, SchemaSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeDocument extends Node {
  override name = 'doc';

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      marks: 'code em strong link bookmark', // TODO: why is it necessary for convertCodeParagraphsToCodeBlocks?
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
