import type { Node, Schema } from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';
import { parse_content, parse_styles, unzip } from '@kerebron/odt-wasm';

import { OdtParser } from './OdtParser.ts';
import { getDefaultsPostProcessFilters } from './postprocess/postProcess.ts';

export interface OdtConfig {
  linkFromRewriter?(href: string): string;
}

export class ExtensionOdt extends Extension {
  name = 'odt';

  constructor(config: OdtConfig = {}) {
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const config = this.config;

    const odtConverter = {
      fromDoc: async (document: Node): Promise<Uint8Array> => {
        throw new Error('Not implemented');
      },
      toDoc: async (buffer: Uint8Array): Promise<Node> => {
        const doc = await odtConverter.odtToJson(buffer);

        const filterCommands = getDefaultsPostProcessFilters();

        if (filterCommands.length > 0) {
          const subEditor = editor.clone();
          subEditor.setDocument(doc.toJSON());

          for (const filter of filterCommands) {
            filter(
              subEditor.state,
              (tr) => subEditor.dispatchTransaction(tr),
            );
          }

          return subEditor.getDocument();
        }

        return doc;
      },
      odtToJson: async (buffer: Uint8Array) => {
        const files = unzip(buffer);
        const filesMap: Record<string, Uint8Array> = {};
        for (const k of files.keys()) {
          filesMap[k] = Uint8Array.from(files.get(k));
        }

        const stylesTree = parse_styles(files.get('styles.xml'));
        const contentTree = parse_content(files.get('content.xml'));

        const parser = new OdtParser(editor.schema, config);

        const doc = parser.parse({ ...filesMap, contentTree, stylesTree });
        return doc;
      },
    };

    return {
      'application/vnd.oasis.opendocument.text': odtConverter,
    };
  }
}
