import { Schema } from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';
import { parse_content, parse_styles, unzip } from '@kerebron/odt-wasm';

import { OdtParser } from './OdtParser.ts';
import {getDefaultsPostProcessFilters} from './postprocess/postProcess.ts';

export interface OdtConfig {
  linkFromRewriter?(href: string): string;
}

export class ExtensionOdt extends Extension {
  name = 'odt';

  constructor(protected config: OdtConfig = {}) {
    super(config);
  }

  getConverters(editor: CoreEditor, schema: Schema): Record<string, Converter> {
    const config = this.config;
    return {
      'application/vnd.oasis.opendocument.text': {
        fromDoc(document) {
          throw new Error('Not implemented');
        },
        toDoc(content: Uint8Array) {
          const files = unzip(content);

          const stylesTree = parse_styles(files.get('styles.xml'));
          const contentTree = parse_content(files.get('content.xml'));

          // console.log(JSON.stringify(stylesTree, null, 2).split('\n').slice(0, 20).join('\n'));
          // console.log(JSON.stringify(contentTree, null, 2).split('\n').slice(0, 20).join('\n'));

          const subEditor = editor.clone();

          const parser = new OdtParser(subEditor.schema, config);

          const doc = parser.parse({ ...files, contentTree, stylesTree });

          const filterCommands = getDefaultsPostProcessFilters();

          if (filterCommands.length > 0) {
            subEditor.setDocument(doc);

            for (const filter of filterCommands) {
              filter(subEditor.state, tr => subEditor.dispatchTransaction(tr));
            }

            return subEditor.getDocument();
          }

          return doc;
        },
      },
    };
  }
}
