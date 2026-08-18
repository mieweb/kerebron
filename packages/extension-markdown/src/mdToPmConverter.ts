import { Node, Schema } from 'prosemirror-model';
import { DOMParser } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { MdConfig } from '@kerebron/extension-markdown';
import {
  decodeEntity,
  elementFromString,
} from '@kerebron/extension-basic-editor/ExtensionHtml';

import type { Token } from './types.ts';

import { MarkdownParser, type MarkdownParseState } from './MarkdownParser.ts';

function listIsTight(tokens: readonly Token[], i: number) {
  while (++i < tokens.length) {
    if (tokens[i].type != 'list_item_open') return tokens[i].hidden;
  }
  return false;
}

export async function mdToPmConverter(
  buffer: Uint8Array,
  config: MdConfig,
  schema: Schema,
): Promise<Node> {
  const content = new TextDecoder().decode(buffer);
  return mdToPmConverterText(content, config, schema);
}

export async function mdToPmConverterText(
  content: string,
  config: MdConfig,
  schema: Schema,
): Promise<Node> {
  if (!config.tokenizer) {
    throw new Error('No config.tokenizer');
  }

  const defaultMarkdownParser = new MarkdownParser(
    schema,
    config,
    {
      frontmatter: {
        custom: (
          state: MarkdownParseState,
          token: Token,
        ) => {
          const topNode = state.stack[0];
          if (topNode?.type.name === 'doc') {
            if (config.frontmatter) {
              const meta = config.frontmatter.parse(token.content) || undefined;
              topNode.attrs = { ...topNode.attrs, meta };
            }
          }
        },
      },
      blockquote: { block: 'blockquote' },
      paragraph: { block: 'paragraph' },
      task_item: { block: 'task_item' },
      task_list: {
        block: 'task_list',
      },
      list_item: {
        block: 'list_item',
        getAttrs: (tok) => ({ type: tok.markup }),
      },
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
      dl: {
        block: 'dl',
      },
      dt: {
        block: 'dt',
      },
      dd: {
        block: 'dd',
      },
      heading: {
        block: 'heading',
        getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
      },
      code_block: {
        block: 'code_block',
        getAttrs: (tok) => ({ lang: tok.attrGet('lang') || undefined }),
        noCloseToken: true,
      },
      fence: {
        block: 'code_block',
        getAttrs: (tok) => ({ lang: tok.attrGet('lang') || undefined }),
        noCloseToken: true,
      },
      hr: {
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          state.openNode(schema.nodes['paragraph'], {});
          state.addNode(schema.nodes['hr'], {});
          state.closeNode();
        },
      },
      image: {
        node: 'image',
        getAttrs: (tok) => {
          const firstChild = tok.children ? tok.children[0] : undefined;
          return {
            src: tok.attrGet('src'),
            title: tok.attrGet('title') || null,
            alt: firstChild?.content || null,
          };
        },
      },
      entity: {
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          state.addText(decodeEntity(token.content));
        },
      },
      hardbreak: { node: 'br' },
      softbreak: { node: 'softbreak' },
      em: { mark: 'em' },
      underline: { mark: 'underline' },
      strong: { mark: 'strong' },
      strike: { mark: 'strike' },
      link: {
        mark: 'link',
        getAttrs: (tok) => ({
          href: tok.attrGet('href'),
          title: tok.attrGet('title') || null,
        }),
      },
      code: { mark: 'code' },
      math: {
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          state.openNode(schema.nodes['math'], {
            content: token.content,
            lang: token.attrGet('lang'),
          });
          state.closeNode();
        },
      },
      html_inline: {
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          const parser = DOMParser.fromSchema(schema);
          const div = elementFromString(token.content);

          const slice = parser.parseSlice(div);
          if (state.stack.find((s) => s.type.name === 'paragraph')) {
            state.importNodes(slice.content.content);
          } else {
            state.openNode(schema.nodes['paragraph'], {});
            state.importNodes(slice.content.content);
            state.closeNode();
          }
        },
      },
      html_block: {
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          const parser = DOMParser.fromSchema(schema);
          const div = elementFromString(token.content);

          const hasBlock = [...div.children].some((el) =>
            /^(P|DIV|TABLE|UL|OL|LI|BLOCKQUOTE|H[1-6])$/.test(el.tagName)
          );

          if (hasBlock) {
            const parsed = parser.parse(div);
            state.importNodes(parsed.content.content);
          } else {
            const slice = parser.parseSlice(div);
            if (state.stack.find((s) => s.type.name === 'paragraph')) {
              state.importNodes(slice.content.content);
            } else {
              state.openNode(schema.nodes['paragraph'], {});
              state.importNodes(slice.content.content);
              state.closeNode();
            }
          }
        },
      },
      footnote_ref: {
        block: 'code_block',
      },
      table: {
        block: 'table',
      },
      tr: {
        block: 'table_row',
      },
      td: {
        block: 'table_cell',
      },
      th: {
        block: 'table_header',
      },
      thead: {
        ignore: true,
      },
    },
  );

  const origDocument = defaultMarkdownParser.parse(content);

  if (config.telemetry.enabled) {
    config.telemetry.event('origDocument', origDocument);
  }

  const filterCommands = [...(config.hooks || [])];
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

  if (config.telemetry.enabled) {
    config.telemetry.event('filteredDocument', state.doc);
  }

  return state.doc;
}
