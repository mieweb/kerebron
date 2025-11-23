import { Node, Schema } from 'prosemirror-model';
import { DOMParser } from 'prosemirror-model';

import { MdConfig } from '@kerebron/extension-markdown';
import { elementFromString } from '@kerebron/extension-basic-editor/ExtensionHtml';

import type { Token } from './types.ts';

import { MarkdownParser, type MarkdownParseState } from './MarkdownParser.ts';
import { sitterTokenizer } from './treeSitterTokenizer.ts';

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
  const tokenizer = await sitterTokenizer();

  const defaultMarkdownParser = new MarkdownParser(
    schema,
    tokenizer,
    {
      frontmatter: {
        node: 'frontmatter',
      },
      blockquote: { block: 'blockquote' },
      paragraph: { block: 'paragraph' },
      task_item: { block: 'task_item' },
      task_list: {
        block: 'task_list',
      },
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
      code_block: { block: 'code_block', noCloseToken: true },
      fence: {
        block: 'code_block',
        getAttrs: (tok) => ({ params: tok.info || '' }),
        noCloseToken: true,
      },
      hr: { node: 'hr' },
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
      hardbreak: { node: 'br' },
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
      html_block: { // TODO
        custom: (
          state: MarkdownParseState,
          token: Token,
          tokens: Token[],
          i: number,
        ) => {
          const parser = DOMParser.fromSchema(schema);
          const parsed = parser.parse(elementFromString(token.content));

          // state.importNodes(parsed.children); // breaks lsptoy example
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

  return defaultMarkdownParser.parse(content);
}
