import { Node, Schema } from 'prosemirror-model';
import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';
import { createNodeFromObject } from '@kerebron/editor/utilities';
import { NodeCodeJar, NodeCodeJarConfig } from './NodeCodeJar.ts';

export * from './NodeCodeJar.ts';

export interface ExtensionCodeJarConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export class ExtensionCodeJar extends Extension {
  override name = 'code-jar';

  nodeCodeJar = new NodeCodeJar({});
  requires = [
    this.nodeCodeJar,
  ];

  constructor(protected override config: ExtensionCodeJarConfig = {}) {
    super(config);
  }

  override created(): void {
    this.nodeCodeJar.config.languageWhitelist = this.config.languageWhitelist;
    // theme: config.theme,
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
