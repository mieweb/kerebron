import type { Mark, Node, Schema } from 'prosemirror-model';
import { DOMSerializer, Fragment } from 'prosemirror-model';
import MarkdownIt from 'markdown-it';

import Token from 'markdown-it/lib/token.mjs';
import {
  type Converter,
  type CoreEditor,
  Extension,
  NodeAndPos,
  nodeToTreeStringOutput,
} from '@kerebron/editor';

import { DocumentMarkdownTokenizer } from './DocumentMarkdownTokenizer.ts';
import { MarkdownParser } from './MarkdownParser.ts';

import { MarkdownSerializer } from '@kerebron/extension-markdown/MarkdownSerializer';
import { SmartOutput } from '../../editor/src/utilities/SmartOutput.ts';

function listIsTight(tokens: readonly Token[], i: number) {
  while (++i < tokens.length) {
    if (tokens[i].type != 'list_item_open') return tokens[i].hidden;
  }
  return false;
}

function removeMarkedContent(node, markType) {
  if (node.isText) {
    const hasMark = node.marks.some((mark) => mark.type === markType);
    return hasMark ? null : node;
  }

  if (node.isLeaf) {
    return node;
  }

  const newContent = [];

  node.content.forEach((child) => {
    const cleaned = removeMarkedContent(child, markType);
    if (cleaned) {
      newContent.push(cleaned);
    }
  });

  return node.copy(Fragment.fromArray(newContent));
}

function convertDomToLowerCase(node) {
  // If the node is an element, change its tag name and attributes
  if (node.nodeType === 1) { // Element node
    // Convert tag name to lowercase
    try {
      node.nodeName = node.nodeName.toLowerCase();
    } catch (ignore) {
      /* HACK FOR: Uncaught TypeError: setting getter-only property "nodeName" */
    }

    // Loop through attributes and convert them to lowercase
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      node.setAttribute(attr.name.toLowerCase(), attr.value);
    }
  }

  // Recursively convert children nodes
  for (let i = 0; i < node.childNodes.length; i++) {
    convertDomToLowerCase(node.childNodes[i]);
  }
}

export interface MdContext {
  meta: Record<string, any>;
}

class MdStashContext {
  private ctxStash: Array<MdContext> = [];
  private currentCtx: MdContext;

  constructor() {
    this.currentCtx = {
      meta: {},
    };
    this.stash();
  }

  public stash(): number {
    this.ctxStash.push(this.currentCtx);
    this.currentCtx = {
      ...structuredClone({ ...this.currentCtx }),
    };
    return this.ctxStash.length - 1;
  }

  public unstash() {
    const ctx = this.ctxStash.pop();
    if (!ctx) {
      throw new Error('Unstash failed');
    }
    this.currentCtx = ctx;
  }

  get current() {
    return this.currentCtx;
  }
}

export interface MdConfig {
  sourceMap?: boolean;
  debugTokens?: boolean;
}

export class ExtensionMarkdown extends Extension {
  name = 'markdown';
  private config: Partial<MdConfig>;

  public constructor(config: Partial<MdConfig> = {}) {
    super(config);
    this.config = config;
  }

  getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const domSerializer = DOMSerializer.fromSchema(schema);
    const autoLinks = false; // TODO - config

    const ctx = new MdStashContext();

    return {
      'text/x-markdown': {
        fromDoc: async (document: Node): Promise<Uint8Array> => {
          // TODO: refactor to Tokenizer
          const defaultMarkdownTokenizer = new DocumentMarkdownTokenizer({
            paragraph(node) {
              return {
                open: 'paragraph_open',
                close: 'paragraph_close',
              };
            },
            hr(node) {
              return {
                selfClose: 'hr',
              };
            },

            heading(node) {
              return {
                open: (node) => {
                  if (!node.attrs.level) {
                    throw new Error('No heading level');
                  }
                  const token = new Token(
                    'heading_open',
                    'h' + node.attrs.level,
                    1,
                  );
                  return token;
                },
                ///////
                close: 'heading_close',
              };
              // state.write(state.repeat('#', node.attrs.level) + ' ');
              // state.renderInline(node, false);
              // state.closeBlock(node);
            },

            blockquote(node) {
              return {
                open: 'blockquote_open',
                close: 'blockquote_close',
              };
            },
            bullet_list(node) {
              return {
                open: (node) => {
                  ctx.stash();
                  ctx.current.meta['list_type'] = 'ul';
                  ctx.current.meta['list_type_symbol'] = '*';
                  const token = new Token('bullet_list_open', 'ul', 1);
                  token.attrSet('symbol', '*');
                  return token;
                },
                close: (node) => {
                  ctx.unstash();
                  return new Token('bullet_list_close', 'ul', -1);
                },
              };
            },
            ordered_list(node) {
              return {
                open: (node) => {
                  ctx.stash();
                  ctx.current.meta['list_type'] = 'ol';
                  ctx.current.meta['list_type_symbol'] = node.attrs['type'] ||
                    '1';
                  const token = new Token('ordered_list_open', 'ol', 1);
                  token.attrSet('symbol', node.attrs['type'] || '1');
                  return token;
                },
                close: (node) => {
                  ctx.unstash();
                  return new Token('ordered_list_close', 'ol', -1);
                },
              };
            },
            list_item(node) {
              return {
                open: (node) => {
                  const token = new Token('list_item_open', 'li', 1);
                  if (ctx.current.meta['list_type'] === 'ul') {
                    token.markup = ctx.current.meta['list_type_symbol'] || '-';
                  }
                  return token;
                },
                close: 'list_item_close',
              };
            },

            table(node) {
              return {
                open: 'table_open',
                close: 'table_close',
              };
            },

            table_row(node) {
              return {
                open: 'tr_open',
                close: 'tr_close',
              };
            },

            table_cell(node) {
              return {
                open: 'td_open',
                close: 'td_close',
              };
            },

            table_header(node) {
              return {
                open: 'th_open',
                close: 'th_close',
              };
            },

            br(node) {
              return {
                selfClose: 'hardbreak',
              };
            },

            text(node) {
              return {
                selfClose: (node) => {
                  const token = new Token('text', '', 0);
                  token.content = node.text || '';
                  return token;
                },
              };
            },

            // code_block(node) {
            //   return {
            //     open: 'code_block_open',
            //     close: 'code_block_close',
            //   }

            // }
            // ordered_list(state, node) {
            //   let start = node.attrs.start || 1;
            //   let maxW = String(start + node.childCount - 1).length;
            //   let space = state.repeat(' ', 4);

            //   let numericString = (i: number) => String(i) + '. ';

            //   if (['a'].includes(node.attrs?.type || '')) {
            //     numericString = (i: number) =>
            //       String.fromCharCode('a'.charCodeAt(0) + i - 1) + '.  ';
            //   }
            //   if (['A'].includes(node.attrs?.type || '')) {
            //     numericString = (i: number) =>
            //       String.fromCharCode('A'.charCodeAt(0) + i - 1) + '.  ';
            //   }
            //   if (['I'].includes(node.attrs?.type || '')) {
            //     numericString = (i: number) => `${romanize(i)}. `;
            //   }
            //   if (['i'].includes(node.attrs?.type || '')) {
            //     numericString = (i: number) => `${romanize(i).toLowerCase()}. `;
            //   }

            // html(state, node) {
            //   const domSerializer = DOMSerializer.fromSchema(schema);
            //   const element = domSerializer.serializeNode(node, {
            //     document: globalThis.document,
            //   });
            //   convertDomToLowerCase(element);
            //   const xmlSerializer = new XMLSerializer();
            //   const html = xmlSerializer.serializeToString(element) + '\n';
            //   // state.write(html.replace(/\sxmlns="[^"]*"/, ''));
            //   state.write(html);
            // },
            //
            // code_block(state, node) {
            //   // Make sure the front matter fences are longer than any dash sequence within it
            //   const backticks = node.textContent.match(/`{3,}/gm);
            //   const fence = backticks
            //     ? (backticks.sort().slice(-1)[0] + '`')
            //     : '```';

            //   state.write(fence + (node.attrs.lang || '') + '\n');
            //   state.text(node.textContent, false);
            //   // Add a newline to the current content before adding closing marker
            //   state.write('\n');
            //   state.write(fence);
            //   state.closeBlock(node);
            // },

            //   state.renderList(node, space, (i) => {
            //     const number = start + i;

            //     let nStr = numericString(number);
            //     return state.repeat(' ', maxW - nStr.length) + nStr;
            //   });
            // },

            image(node) {
              return {
                selfClose: (node) => {
                  const token = new Token('image', 'img', 0);
                  token.attrSet('src', node.attrs.src);
                  if (node.attrs.title) {
                    token.attrSet('title', node.attrs.title);
                  }
                  return token;
                },
              };
            },
          }, {
            em: {
              open: 'em_open',
              close: 'em_close',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            strong: {
              open: 'strong_open',
              close: 'strong_close',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            underline: {
              open: '',
              close: '',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            strike: {
              open: 'strike_open',
              close: 'strike_close',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            link: {
              open: (mark: Mark) => {
                const token = new Token('link_open', 'a', 1);
                token.attrSet('href', mark.attrs.href);
                return token;
              },
              close: 'link_close',
              mixable: true,
            },
            code: {
              open: 'code_inline',
              close: 'code_inline',
              mixable: false,
            },
            // bookmark: {
            //   open(state, mark) {
            //     const id = mark.attrs.id;
            //     if (state.alreadyOutputedIds.has(id)) {
            //       return '';
            //     }

            //     state.alreadyOutputedIds.add(id);
            //     return `<a id="${id}"></a>`;
            //   },
            //   close() {
            //     return '';
            //   },
            // },
            // code: {
            //   open(_state, _mark, parent, index) {
            //     return backticksFor(parent.child(index), -1);
            //   },
            //   close(_state, _mark, parent, index) {
            //     return backticksFor(parent.child(index - 1), 1);
            //   },
            //   escape: false,
            // },
          });

          document = removeMarkedContent(document, schema.marks.change);
          // deleteAllMarkedText('change', state, dispatch)

          const tokens = defaultMarkdownTokenizer.serialize(document);

          if (this.config.debugTokens) {
            const event = new CustomEvent('md:tokens', {
              detail: {
                tokens,
              },
            });
            editor.dispatchEvent(event);
          }

          const serializer = new MarkdownSerializer();
          const output = await serializer.serialize(tokens);

          if (this.config.sourceMap) {
            // https://sourcemaps.info/spec.html
            // https://evanw.github.io/source-map-visualization/
            // https://github.com/evanw/source-map-visualization/blob/gh-pages/code.js

            const debugOutput = new SmartOutput<NodeAndPos>();
            nodeToTreeStringOutput(debugOutput, document);

            const debugMap: Record<
              number,
              { targetRow: number; targetCol: number }
            > = {};

            debugOutput.getSourceMap(
              (item: NodeAndPos, targetRow: number, targetCol: number) => {
                debugMap[item.pos] = {
                  targetRow,
                  targetCol,
                };
              },
            );

            const markdownMap: Record<
              number,
              { targetRow: number; targetCol: number }
            > = {};

            const sourceMap = output.getSourceMap(
              (item: Token, targetRow: number, targetCol: number) => {
                if (item?.map) {
                  const pos = item.map[0];

                  markdownMap[pos] = {
                    targetRow,
                    targetCol,
                  };

                  if (debugMap[pos]) {
                    return {
                      sourceNo: 0,
                      sourceRowPos: debugMap[pos].targetRow,
                      sourceColPos: debugMap[pos].targetCol,
                    };
                  }
                }
              },
            );

            sourceMap.file = 'target.md';
            sourceMap.sources = ['debug.txt'];
            sourceMap.sourcesContent = [debugOutput.toString()];

            const event = new CustomEvent('md:sourcemap', {
              detail: {
                sourceMap,
                debugMap,
                markdownMap,
              },
            });
            editor.dispatchEvent(event);
          }

          return new TextEncoder().encode(output.toString());
        },
        toDoc: async (buffer: Uint8Array): Promise<Node> => {
          const content = new TextDecoder().decode(buffer);
          /// A parser parsing unextended [CommonMark](http://commonmark.org/),
          /// without inline HTML, and producing a document in the basic schema.
          const defaultMarkdownParser = new MarkdownParser(
            schema,
            MarkdownIt('commonmark', { html: false }),
            {
              blockquote: { block: 'blockquote' },
              paragraph: { block: 'paragraph' },
              list_item: { block: 'list_item' },
              bullet_list: {
                block: 'bullet_list',
                getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
              },
              ordered_list: {
                block: 'ordered_list',
                getAttrs: (tok, tokens, i) => ({
                  start: +tok.attrGet('start')! || 1,
                  tight: listIsTight(tokens, i),
                }),
              },
              heading: {
                block: 'heading',
                getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
              },
              code_block: { block: 'code_block', noCloseToken: true },
              fence: {
                block: 'code_block',
                getAttrs: (tok) => ({ params: tok.info || '' }),
                noCloseToken: true,
              },
              hr: { node: 'hr' },
              image: {
                node: 'image',
                getAttrs: (tok) => ({
                  src: tok.attrGet('src'),
                  title: tok.attrGet('title') || null,
                  alt: tok.children![0] && tok.children![0].content || null,
                }),
              },
              hardbreak: { node: 'br' },
              em: { mark: 'em' },
              strong: { mark: 'strong' },
              link: {
                mark: 'link',
                getAttrs: (tok) => ({
                  href: tok.attrGet('href'),
                  title: tok.attrGet('title') || null,
                }),
              },
              code_inline: { mark: 'code', noCloseToken: true },
              html_block: { // TODO
                block: 'code_block',
              },
            },
          );

          return defaultMarkdownParser.parse(content);
        },
      },
    };
  }
}
