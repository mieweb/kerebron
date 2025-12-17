import type { Node, Schema } from 'prosemirror-model';

import {
  type Converter,
  type CoreEditor,
  Extension,
  type UrlRewriter,
} from '@kerebron/editor';
import { parse_content, parse_styles, unzip } from '@kerebron/odt-wasm';

import { OdtParser, OdtParserConfig } from './OdtParser.ts';
import { getDefaultsPostProcessFilters } from './postprocess/postProcess.ts';
import { Command } from '@kerebron/editor/commands';

export interface OdtConfig extends OdtParserConfig {
  debug?: boolean;
  postProcessCommands?: Command[];
}

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
    const config = this.config;

    const odtConverter = {
      fromDoc: async (document: Node): Promise<Uint8Array> => {
        throw new Error('Not implemented');
      },
      toDoc: async (buffer: Uint8Array): Promise<Node> => {
        const { doc, filesMap } = await odtConverter.odtToJson(buffer);

        const filterCommands = getDefaultsPostProcessFilters({
          doc,
          filesMap,
        }).concat(
          this.config.postProcessCommands || [],
        );

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

        if (this.urlFromRewriter) {
          const nodesToProcess: Array<{ node: Node; pos: number }> = [];
          doc.descendants((node, pos) => {
            if (node.type.name === 'image') {
              nodesToProcess.push({ node, pos });
            }
          });

          // TODO
          //       if (ctx.urlRewriter) {
          // href = ctx.urlRewriter(href, { type: 'A', dest: 'kerebron' });
          // }

          const tr = this.editor.state.tr;
          for (const { node, pos } of nodesToProcess) {
            let src = node.attrs.src || '';

            src = await this.urlFromRewriter(src, {
              type: 'IMG',
              dest: 'kerebron',
              filesMap,
            });

            if (src !== node.attrs.src) {
              const nodeType = this.editor.schema.nodes[node.type.name];
              const replaceNode = nodeType.create(
                { ...node.attrs, src },
                node.content,
                node.marks,
              );
              tr.replaceWith(
                tr.mapping.map(pos),
                tr.mapping.map(pos + node.nodeSize),
                replaceNode,
              );
            }
          }
          editor.view.dispatch(tr);
        }

        return { doc, stylesTree, contentTree, filesMap };
      },
    };

    return {
      'application/vnd.oasis.opendocument.text': odtConverter,
    };
  }
}
