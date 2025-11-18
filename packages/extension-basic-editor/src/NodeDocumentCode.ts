import { NodeSpec } from 'prosemirror-model';

import { Node } from '@kerebron/editor';

export class NodeDocumentCode extends Node {
  override name = 'doc_code';

  override getNodeSpec(): NodeSpec {
    return {
      content: 'code_block',
      defaultAttrs: {
        'lang': this.config.lang || null,
      },
      EMPTY_DOC: {
        'type': this.name,
        'content': [
          {
            'type': 'code_block',
            'attrs': {
              'lang': this.config.lang || null,
            },
            'content': [
              // {
              //   "type": "text",
              // "text": ""
              // }
            ],
          },
        ],
      },
    };
  }
}
