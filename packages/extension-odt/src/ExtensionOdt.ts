import { DOMSerializer, Schema } from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';
import { Mark } from '@kerebron/editor';

import { unzip, parseContent, parseStyles } from "@kerebron/odt-wasm";
import {OdtParser} from "./OdtParser.ts";

export class ExtensionOdt extends Extension {
  name = 'odt';

  getConverters(schema: Schema): Record<string, Converter> {
    return {
      'application/vnd.oasis.opendocument.text': {
        fromDoc(document) {
          throw new Error('Not implemented');
        },
        toDoc(content: Uint8Array) {
          const files = unzip(content);

          const stylesTree = parseStyles(files.get('styles.xml'));
          const contentTree = parseContent(files.get('content.xml'));

          // console.log(JSON.stringify(stylesTree, null, 2).split('\n').slice(0, 20).join('\n'));
          // console.log(JSON.stringify(contentTree, null, 2).split('\n').slice(0, 20).join('\n'));

          const parser = new OdtParser(schema);

          return parser.parse({ ...files, contentTree, stylesTree });
        },
      },
    };
  }
}
