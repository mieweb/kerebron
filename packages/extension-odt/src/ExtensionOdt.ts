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
import { InputRulesPlugin } from '@kerebron/editor/plugins/input-rules';

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
    const config = this.config;

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

        const plugin = editor.state.plugins.find((plugin) =>
          plugin instanceof InputRulesPlugin
        );
        if (plugin) {
          // plugin.props.
        }

        const subEditor = editor.clone();
        subEditor.setDocument(doc.toJSON());

        let modified = false;
        if (this.urlFromRewriter) {
          const imageNodes: Array<{ node: Node; pos: number }> = [];
          subEditor.getDocument().descendants((node, pos) => {
            if (node.type.name === 'image') {
              imageNodes.push({ node, pos });
            }
          });

          const linkNodes: Array<{ node: Node; pos: number }> = [];
          subEditor.getDocument().descendants((node, pos) => {
            if (node.marks.find((mark) => mark.type.name === 'link')) {
              linkNodes.push({ node, pos });
            }
          });

          const tr = subEditor.state.tr;

          for (const { node, pos } of linkNodes) {
            const linkMark = node.marks.find((mark) =>
              mark.type.name === 'link'
            );
            if (!linkMark) {
              continue;
            }
            let href = linkMark.attrs.href || '';
            href = await this.urlFromRewriter(href, {
              type: 'A',
              dest: 'kerebron',
            });
            if (href !== linkMark.attrs.href) {
              const newMarks = node.marks.map((mark) => {
                if (mark.type.name === 'link') {
                  const markType = this.editor.schema.marks['link'];
                  return markType.create({ ...mark.attrs, href });
                }
                return mark;
              });

              const nodeType = this.editor.schema.nodes[node.type.name];
              let replaceNode;
              if (nodeType.isText) {
                replaceNode = this.editor.schema.text(
                  node.text || '',
                  newMarks,
                );
              } else {
                replaceNode = nodeType.create(
                  node.attrs,
                  node.content,
                  newMarks,
                );
              }
              tr.replaceWith(
                tr.mapping.map(pos),
                tr.mapping.map(pos + node.nodeSize),
                replaceNode,
              );
            }
          }

          for (const { node, pos } of imageNodes) {
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
          subEditor.dispatchTransaction(tr), modified = true;
        }

        if (filterCommands.length > 0) {
          for (const filter of filterCommands) {
            filter(
              subEditor.state,
              (tr) => subEditor.dispatchTransaction(tr),
            );
          }
          modified = true;
        }

        if (modified) {
          return subEditor.getDocument();
        }

        return doc;
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
