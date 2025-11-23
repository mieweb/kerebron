import { Node, Schema } from 'prosemirror-model';
import {
  AnyExtensionOrReq,
  type Converter,
  type CoreEditor,
  Extension,
} from '@kerebron/editor';
import { createNodeFromObject } from '@kerebron/editor/utilities';
import { NodeCodeMirror, NodeCodeMirrorConfig } from './NodeCodeMirror.ts';

export * from './NodeCodeMirror.ts';

export interface ExtensionCodeMirrorConfig {
  languageWhitelist?: NodeCodeMirrorConfig['languageWhitelist'];
  theme?: NodeCodeMirrorConfig['theme'];
  readOnly?: boolean;
}

export class ExtensionCodeMirror extends Extension {
  override name = 'code-mirror';
  requires: AnyExtensionOrReq[];

  constructor(protected override config: ExtensionCodeMirrorConfig) {
    super(config);

    this.requires = [
      new NodeCodeMirror({
        languageWhitelist: config.languageWhitelist,
        theme: config.theme,
      }),
    ];
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
