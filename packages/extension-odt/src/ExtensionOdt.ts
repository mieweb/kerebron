import type { Node, Schema } from 'prosemirror-model';

import {
  type Converter,
  type CoreEditor,
  Extension,
  type UrlRewriter,
} from '@kerebron/editor';
import {
  init_debug,
  parse_content,
  parse_styles,
  unzip,
} from '@kerebron/odt-wasm';

import { OdtParser, OdtParserConfig } from './OdtParser.ts';
import { getDefaultsPostProcessFilters } from './postprocess/postProcess.ts';
import { Command } from '@kerebron/editor/commands';
import { EditorState, Transaction } from 'prosemirror-state';
import { urlRewrite } from './postprocess/urlRewrite.ts';

export interface OdtConfig extends OdtParserConfig {
  debug?: boolean;
  postProcessCommands?: Command[];
}

init_debug();

export class ExtensionOdt extends Extension {
  name = 'odt';
  public urlFromRewriter?: UrlRewriter;

  constructor(public override config: OdtConfig = {}) {
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const odtConverter = {
      fromDoc: async (document: Node): Promise<Uint8Array> => {
        throw new Error('Not implemented');
      },
      toDoc: async (buffer: Uint8Array): Promise<Node> => {
        const { doc, filesMap } = odtConverter.odtToJson(buffer);

        const filterCommands = getDefaultsPostProcessFilters({
          doc,
          filesMap,
        }).concat(
          this.config.postProcessCommands || [],
        );

        let state = EditorState.create({ doc });
        const dispatch = (tr: Transaction) => {
          state = state.apply(tr);
        };

        if (this.urlFromRewriter) {
          await urlRewrite(this.urlFromRewriter, filesMap, state, dispatch);
        }

        if (filterCommands.length > 0) {
          for (const filter of filterCommands) {
            filter(
              state,
              (tr) => dispatch(tr),
            );
          }
        }

        if (this.config.debug) {
          const event = new CustomEvent('odt:pmdoc:filtered', {
            detail: {
              doc: state.doc,
            },
          });
          this.editor.dispatchEvent(event);
        }

        return state.doc;
      },
      odtToJson: (buffer: Uint8Array) => {
        const files = unzip(buffer);
        const filesMap: Record<string, Uint8Array> = {};
        for (const k of files.keys()) {
          filesMap[k] = Uint8Array.from(files.get(k));
        }

        const stylesTree = parse_styles(files.get('styles.xml'));
        const contentTree = parse_content(files.get('content.xml'));

        if (this.config.debug) {
          const event = new CustomEvent('odt:parsed', {
            detail: {
              stylesTree,
              contentTree,
              filesMap,
            },
          });
          this.editor.dispatchEvent(event);
        }

        const parser = new OdtParser(editor.schema, this.config);
        parser.filesMap = filesMap;

        const doc = parser.parse({ ...filesMap, contentTree, stylesTree });

        if (this.config.debug) {
          const event = new CustomEvent('odt:pmdoc', {
            detail: {
              doc,
            },
          });
          this.editor.dispatchEvent(event);
        }

        return { doc, stylesTree, contentTree, filesMap };
      },
    };

    return {
      'application/vnd.oasis.opendocument.text': odtConverter,
    };
  }
}
