import { Mark, Node, Schema } from 'prosemirror-model';
import {
  NESTING_CLOSING,
  NESTING_OPENING,
  NESTING_SELF_CLOSING,
  Token,
} from './types.ts';

import {
  type CoreEditor,
  NodeAndPos,
  nodeToTreeStringOutput,
  RawTextMapEntry,
  RawTextResult,
  SourceMap,
} from '@kerebron/editor';

import { MarkdownSerializer } from './MarkdownSerializer.ts';
import { DocumentMarkdownTokenizer } from './DocumentMarkdownTokenizer.ts';
import { SmartOutput } from '@kerebron/editor/utilities';
import { MdConfig } from '@kerebron/extension-markdown';
import { getDefaultsPreProcessFilters } from './preprocess/preProcess.ts';
import { EditorState, Transaction } from 'prosemirror-state';

// function convertDomToLowerCase(node: Node) {
//   // If the node is an element, change its tag name and attributes
//   if (node.nodeType === 1) { // Element node
//     // Convert tag name to lowercase
//     try {
//       node.nodeName = node.nodeName.toLowerCase();
//     } catch (ignore) {
//       /* HACK FOR: Uncaught TypeError: setting getter-only property "nodeName" */
//     }

//     // Loop through attributes and convert them to lowercase
//     for (let i = 0; i < node.attributes.length; i++) {
//       const attr = node.attributes[i];
//       node.setAttribute(attr.name.toLowerCase(), attr.value);
//     }
//   }

//   // Recursively convert children nodes
//   for (let i = 0; i < node.childNodes.length; i++) {
//     convertDomToLowerCase(node.childNodes[i]);
//   }
// }

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

export async function pmToMdConverter(
  document: Node,
  config: MdConfig,
  schema: Schema,
  editor: CoreEditor,
): Promise<Uint8Array> {
  const result = await extPmToMdConverter(document, config, schema, editor);
  return new TextEncoder().encode(result.content);
}

export interface MarkdownResult extends RawTextResult {
  debugMap: Record<number, { targetRow: number; targetCol: number }>;
  sourceMap?: SourceMap;
}

export async function extPmToMdConverter(
  origDocument: Node,
  config: MdConfig,
  schema: Schema,
  editor: CoreEditor,
): Promise<MarkdownResult> {
  const ctx = new MdStashContext();

  let filteredDoc: Node;

  // TODO: refactor to Tokenizer
  const defaultMarkdownTokenizer = new DocumentMarkdownTokenizer({
    paragraph(node) {
      return {
        open: async (node, pos, idx) => {
          const token = new Token('paragraph_open', 'p', NESTING_OPENING);
          const $pos = filteredDoc.resolve(pos);
          const parent = $pos.parent;
          if (parent?.type.name === 'table_cell' && idx > 0) {
            token.attrSet('not_first_para', '1');
          }
          return token;
        },
        close: async (node, pos, idx, openToken) => {
          const token = new Token('paragraph_close', 'p', NESTING_CLOSING);

          let singleChild: Node | undefined;
          if (node.children.length === 1) {
            if (node.children[0].type.name === 'shortcode_inline') {
              singleChild = node.children[0];
            }
          }
          if (singleChild) {
            if (singleChild.attrs.nesting !== NESTING_CLOSING) {
              openToken.attrSet('margin_before', '1');
            }
            if (singleChild.attrs.nesting !== NESTING_OPENING) {
              token.attrSet('margin_after', '1');
            }
          } else {
            openToken.attrSet('margin_before', '1');
            token.attrSet('margin_after', '1');
          }

          return token;
        },
      };
    },
    hr(node) {
      return {
        selfClose: 'hr',
        margin: 'both',
      };
    },

    heading(node) {
      return {
        open: async (node) => {
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
        margin: 'both',
      };
    },

    blockquote(node) {
      return {
        open: 'blockquote_open',
        close: 'blockquote_close',
      };
    },

    math() {
      return {
        selfClose: async (node) => {
          const token = new Token('math', 'math', 0);
          token.content = node.attrs.content;
          token.attrSet('lang', node.attrs.lang);
          token.meta = 'noEscText';
          return token;
        },
      };
    },

    task_list(node) {
      return {
        open: async (node) => {
          ctx.stash();
          ctx.current.meta['list_type'] = 'tl';
          ctx.current.meta['list_type_symbol'] = '';
          const token = new Token('task_list_open', 'ul', 1);
          token.attrSet('symbol', '*');
          return token;
        },
        close: async (node) => {
          ctx.unstash();
          return new Token('task_list_close', 'ul', -1);
        },
        margin: 'both',
      };
    },
    bullet_list(node) {
      return {
        open: async (node, pos, idx) => {
          ctx.stash();
          ctx.current.meta['list_type'] = 'ul';
          ctx.current.meta['list_type_symbol'] = '*';
          const token = new Token('bullet_list_open', 'ul', 1);
          token.attrSet('symbol', '*');

          const firstChild = filteredDoc.nodeAt(pos + 1);
          if (firstChild?.type.name === 'list_item') {
            token.attrSet('first_level_type', firstChild.attrs.type);
          }
          const $pos = filteredDoc.resolve(pos);
          const parent = $pos.parent;
          const parent2 = $pos.node($pos.depth - 1);

          if (parent?.type.name === 'table_cell' && idx > 0) {
            token.attrSet('not_first_para', '1');
          }
          return token;
        },
        close: async (node, pos) => {
          ctx.unstash();
          const token = new Token('bullet_list_close', 'ul', -1);

          const firstChild = filteredDoc.nodeAt(pos + 1);
          if (firstChild?.type.name === 'list_item') {
            token.attrSet('first_level_type', firstChild.attrs.type);
          }
          return token;
        },
        margin: 'both',
      };
    },
    ordered_list(node) {
      return {
        open: async (node, pos, idx) => {
          ctx.stash();
          ctx.current.meta['list_type'] = 'ol';
          ctx.current.meta['list_type_symbol'] = node.attrs['type'] ||
            '1';
          const token = new Token('ordered_list_open', 'ol', 1);
          token.attrSet('symbol', node.attrs['type'] || '1');
          token.attrSet('start', node.attrs['start']);

          const firstChild = filteredDoc.nodeAt(pos + 1);
          if (firstChild?.type.name === 'list_item') {
            token.attrSet('first_level_type', firstChild.attrs.type);
          }
          const $pos = filteredDoc.resolve(pos);
          const parent = $pos.parent;
          if (parent?.type.name === 'table_cell' && idx > 0) {
            token.attrSet('not_first_para', '1');
          }
          return token;
        },
        close: async (node, pos) => {
          ctx.unstash();
          const token = new Token('ordered_list_close', 'ol', -1);

          const firstChild = filteredDoc.nodeAt(pos + 1);
          if (firstChild?.type.name === 'list_item') {
            token.attrSet('first_level_type', firstChild.attrs.type);
          }
          return token;
        },
        margin: 'both',
      };
    },
    list_item(node) {
      return {
        open: async (node) => {
          const token = new Token('list_item_open', 'li', 1);
          if (node.attrs['value']) {
            token.attrSet('value', node.attrs['value']);
          }
          if (node.attrs['type']) {
            token.attrSet('type', node.attrs['type']);
          }
          if (ctx.current.meta['list_type'] === 'ul') {
            token.markup = ctx.current.meta['list_type_symbol'] || '-';
          }
          return token;
        },
        close: 'list_item_close',
      };
    },
    task_item(node) {
      return {
        open: async (node) => {
          const token = new Token('task_item_open', 'li', 1);
          token.attrSet('checked', node.attrs.checked ? 'checked' : '');
          return token;
        },
        close: 'task_item_close',
      };
    },

    table(node) {
      return {
        open: 'table_open',
        close: 'table_close',
        margin: 'both',
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

    softbreak(node) {
      return {
        selfClose: 'softbreak',
      };
    },

    text(node) {
      return {
        selfClose: (node: Node) => {
          const token = new Token('text', '', 0);
          token.content = node.text || '';
          return Promise.resolve(token);
        },
      };
    },

    code_block(node) {
      return {
        selfClose: (node: Node) => {
          const token = new Token('code_block', 'code', 0);
          token.meta = 'noEscText';
          token.attrSet('lang', node.attrs.lang);
          token.content = '';
          node.forEach((child, offset) => {
            token.content += child.text || '';
          });
          return Promise.resolve(token);
        },
        margin: 'both',
      };
    },

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

    image(node) {
      return {
        selfClose: (node: Node) => {
          let src = node.attrs.src;
          if (config.urlRewriter) {
            // src = await config.urlRewriter(src, { type: 'IMG', dest: 'md' });
          }
          const token = new Token('image', 'img', 0);
          token.attrSet('src', src);
          token.attrSet('origUrl', node.attrs.origUrl);
          if (node.attrs.title) {
            token.attrSet('title', node.attrs.title);
          }
          return Promise.resolve(token);
        },
      };
    },

    shortcode_inline(node) {
      return {
        selfClose: (node: Node) => {
          const token = new Token('shortcode_inline', 'shortcode_inline', 0);
          token.content = node.attrs.content;
          return Promise.resolve(token);
        },
      };
    },
    node_bookmark(node) {
      return {
        selfClose: (node: Node) => {
          const token = new Token('bookmark', 'bookmark', NESTING_SELF_CLOSING);
          token.content = node.attrs.content;
          token.attrSet('id', node.attrs.id);
          return Promise.resolve(token);
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
    underline: {
      open: 'underline_open',
      close: 'underline_close',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    strong: {
      open: 'strong_open',
      close: 'strong_close',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    strike: {
      open: 'strike_open',
      close: 'strike_close',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    math: {
      open: 'math_inline_open',
      close: 'math_inline_close',
      // math_inline
      // selfclose: async (node) => {
      //   const token = new Token('math', 'math', 0);
      //   token.attrSet('content', node.attrs.content);
      //   if (node.attrs.type) {
      //   }
      //   return token;
      // },
    },

    link: {
      open: async (mark: Mark) => {
        const token = new Token('link_open', 'a', 1);
        token.attrSet('href', mark.attrs.href);
        token.attrSet('origUrl', mark.attrs.origUrl);
        return token;
      },
      close: 'link_close',
      mixable: true,
    },
    code: {
      // selfclose: async (node) => {
      //   const token = new Token('code_inline', 'code', 0);
      //   token.content = 'TODO_INLINE_CODE';
      //   // token.attrSet('content', node.attrs.content);
      //   // if (node.attrs.type) {
      //   // }
      //   return token;
      // },
      // open: async (mark: Mark) => {
      // },
      // close: async (mark: Mark) => {
      //   const token = new Token('code_inline', 'code', 0);
      //   token.content = 'TODO_INLINE_CODE';
      //   // token.attrSet('content', node.attrs.content);
      //   // if (node.attrs.type) {
      //   // }
      //   return token;
      // },
      open: 'code_open',
      close: 'code_close',
      escape: false,
    },
  });

  const filterCommands = getDefaultsPreProcessFilters({
    urlRewriter: config.urlRewriter,
  });

  let state = EditorState.create({ doc: origDocument });
  const dispatch = (tr: Transaction) => {
    state = state.apply(tr);
  };

  if (filterCommands.length > 0) {
    for (const filter of filterCommands) {
      await filter(
        state,
        (tr) => dispatch(tr),
      );
    }
  }

  filteredDoc = state.doc;

  const tokens = await defaultMarkdownTokenizer.serialize(filteredDoc);

  if (config.debugTokens) {
    const event = new CustomEvent('md:tokens', {
      detail: {
        tokens,
      },
    });
    editor.dispatchEvent(event);
  }

  const markdownSerializerConfig = {
    debug: config.serializerDebug,
  };

  const serializer = new MarkdownSerializer(markdownSerializerConfig);
  const output = await serializer.serialize(tokens);

  const event = new CustomEvent('md:output', {
    detail: {
      output,
    },
  });
  editor.dispatchEvent(event);

  const debugMap: Record<
    number,
    { targetRow: number; targetCol: number }
  > = {};

  const rawTextMap: Array<
    {
      nodeIdx: number;
      targetRow: number;
      targetCol: number;
      sourceCol?: number;
      targetPos: number;
    }
  > = [];

  let sourceMap: SourceMap | undefined;

  if (config.sourceMap) {
    // https://sourcemaps.info/spec.html
    // https://evanw.github.io/source-map-visualization/
    // https://github.com/evanw/source-map-visualization/blob/gh-pages/code.js

    const debugOutput = new SmartOutput<NodeAndPos>();
    nodeToTreeStringOutput(debugOutput, origDocument);

    debugOutput.getSourceMap(
      (
        targetRow: number,
        targetCol: number,
        pos: number,
        item?: NodeAndPos,
      ) => {
        if (!item) {
          return;
        }
        debugMap[item.pos] = {
          targetRow,
          targetCol,
        };
      },
    );

    sourceMap = output.getSourceMap(
      (
        targetRow: number,
        targetCol: number,
        targetPos: number,
        item?: Token,
      ) => {
        if (item?.map) {
          const pos = item.map[0];
          const sourceCol = item.map[2];

          rawTextMap.push({
            nodeIdx: pos,
            targetPos,
            targetRow,
            targetCol,
            sourceCol,
          });

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
  }

  if (config.dispatchSourceMap) {
    const event = new CustomEvent('md:sourcemap', {
      detail: {
        sourceMap,
        debugMap,
        rawTextMap,
      },
    });
    editor.dispatchEvent(event);
  }

  return {
    content: output.toString(),
    sourceMap,
    debugMap,
    rawTextMap,
  };
}
