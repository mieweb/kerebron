import { Node, Schema } from 'prosemirror-model';

import {
  AnyExtensionOrReq,
  type Converter,
  type CoreEditor,
  Extension,
  RawTextMapEntry,
  RawTextResult,
} from '@kerebron/editor';

import { createNodeFromObject } from '@kerebron/editor/utilities';

import { ExtensionSelection } from './ExtensionSelection.ts';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { ExtensionRemoteSelection } from './remote-selection/ExtensionRemoteSelection.ts';
import { NodeText } from './NodeText.ts';
import { NodeDocumentCode } from './NodeDocumentCode.ts';
import { NodeCodeBlock } from './NodeCodeBlock.ts';

export class ExtensionBasicCodeEditor extends Extension {
  name = 'basic-code-editor';
  requires: AnyExtensionOrReq[];

  constructor({ lang }: { lang: string }) {
    super();

    this.requires = [
      new ExtensionBaseKeymap(),
      new ExtensionDropcursor(),
      new ExtensionGapcursor(),
      new ExtensionHtml(),
      new ExtensionRemoteSelection(),
      new ExtensionSelection(),
      new NodeDocumentCode({ lang }),
      new NodeCodeBlock(),
      new NodeText(),
    ];
  }

  toRawText(doc: Node): RawTextResult {
    const topNodeType = this.editor.schema.topNodeType;
    const spec = topNodeType.spec;
    const singleNodeDoc = spec.content?.indexOf('*') === -1;

    if (!singleNodeDoc) {
      throw new Error('Not a single node doc');
    }

    if (doc.children.length !== 1) {
      throw new Error('Not a single node doc');
    }

    const codeBlock = doc.children[0];

    const content = codeBlock.content.content
      .map((node) => node.text)
      .join('');

    const lines = content.split('\n');

    const rawTextMap: Array<RawTextMapEntry> = [];

    let nodeIdx = 1;
    let targetPos = 0;
    let targetRow = 0;
    for (const line of lines) {
      rawTextMap.push({
        nodeIdx: nodeIdx,
        targetRow,
        targetCol: 0,
        targetPos,
      });

      targetRow++;
      targetPos += line.length + 1;
      nodeIdx += line.length + 1;
    }

    return {
      content,
      rawTextMap,
    };
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/code-only': {
        fromDoc: async (document: Node): Promise<Uint8Array> => {
          const retVal = [];
          if (document.content) {
            for (const node of document.content.toJSON()) {
              if ('code_block' === node.type && Array.isArray(node.content)) {
                for (const content of node.content) {
                  retVal.push(content.text);
                }
              }
            }
          }
          return new TextEncoder().encode(retVal.join(''));
        },
        toDoc: async (buffer: Uint8Array): Promise<Node> => {
          const code = new TextDecoder().decode(buffer);
          const content = {
            'type': 'doc_code',
            'content': [
              {
                'type': 'code_block',
                'attrs': {
                  'lang': schema.topNodeType.spec.defaultAttrs?.lang,
                },
                'content': [
                  {
                    'type': 'text',
                    'text': code,
                  },
                ],
              },
            ],
          };

          return createNodeFromObject(
            content,
            schema,
            {
              errorOnInvalidContent: false,
            },
          );
        },
      },
    };
  }
}
