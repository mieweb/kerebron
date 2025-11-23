import { Mark, MarkType, Node, Schema } from 'prosemirror-model';
import { Fragment } from 'prosemirror-model';
import { Token } from './types.ts';

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

function removeMarkedContent(node: Node, markType: MarkType) {
  if (node.isText) {
    const hasMark = node.marks.some((mark) => mark.type === markType);
    return hasMark ? null : node;
  }

  if (node.isLeaf) {
    return node;
  }

  const newContent: Node[] = [];

  node.content.forEach((child) => {
    const cleaned = removeMarkedContent(child, markType);
    if (cleaned) {
      newContent.push(cleaned);
    }
  });

  return node.copy(Fragment.fromArray(newContent));
}

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
  const result = syncPmToMdConverter(document, config, schema, editor);
  return new TextEncoder().encode(result.content);
}

export interface MarkdownResult extends RawTextResult {
  debugMap: Record<number, { targetRow: number; targetCol: number }>;
  sourceMap?: SourceMap;
}

export function syncPmToMdConverter(
  document: Node,
  config: MdConfig,
  schema: Schema,
  editor: CoreEditor,
): MarkdownResult {
  const ctx = new MdStashContext();

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

    math() {
      return {
        open: 'math_block_open',
        close: 'math_block_close',
        // math_inline
        // selfClose: (node) => {
        //   const token = new Token('math', 'math', 0);
        //   token.attrSet('content', node.attrs.content);
        //   if (node.attrs.type) {
        //   }
        //   return token;
        // },
      };
    },

    task_list(node) {
      return {
        open: (node) => {
          ctx.stash();
          ctx.current.meta['list_type'] = 'tl';
          ctx.current.meta['list_type_symbol'] = '';
          const token = new Token('task_list_open', 'ul', 1);
          token.attrSet('symbol', '*');
          return token;
        },
        close: (node) => {
          ctx.unstash();
          return new Token('task_list_close', 'ul', -1);
        },
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
    task_item(node) {
      return {
        open: (node) => {
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
      // selfClose: (node) => {
      //   const token = new Token('math', 'math', 0);
      //   token.attrSet('content', node.attrs.content);
      //   if (node.attrs.type) {
      //   }
      //   return token;
      // },
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
      // selfClose: (node) => {
      //   const token = new Token('code_inline', 'code', 0);
      //   token.content = 'TODO_INLINE_CODE';
      //   // token.attrSet('content', node.attrs.content);
      //   // if (node.attrs.type) {
      //   // }
      //   return token;
      // },
      // open: (mark: Mark) => {
      // },
      // close: (mark: Mark) => {
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
    // code: {
    //   open(_state, _mark, parent, index) {
    //     return backticksFor(parent.child(index), -1);
    //   },
    //   close(_state, _mark, parent, index) {
    //     return backticksFor(parent.child(index - 1), 1);
    //   },
    //   escape: false,
    // },            // bookmark: {
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
  });

  document = removeMarkedContent(document, schema.marks.change)!;
  // deleteAllMarkedText('change', state, dispatch)

  const tokens = defaultMarkdownTokenizer.serialize(document);

  if (config.debugTokens) {
    const event = new CustomEvent('md:tokens', {
      detail: {
        tokens,
      },
    });
    editor.dispatchEvent(event);
  }

  const serializer = new MarkdownSerializer();
  const output = serializer.serialize(tokens);

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
    nodeToTreeStringOutput(debugOutput, document);

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
