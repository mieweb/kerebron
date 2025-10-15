import type { Node, Schema } from 'prosemirror-model';

import type { Token } from './types.ts';

import { MarkdownParser } from './MarkdownParser.ts';
import { MdConfig } from '@kerebron/extension-markdown';
import { defaultTokenizer } from './defaultTokenizer.ts';

function listIsTight(tokens: readonly Token[], i: number) {
  while (++i < tokens.length) {
    if (tokens[i].type != 'list_item_open') return tokens[i].hidden;
  }
  return false;
}

export default async function mdToPmConverter(
  buffer: Uint8Array,
  config: MdConfig,
  schema: Schema,
): Promise<Node> {
  const content = new TextDecoder().decode(buffer);
  /// A parser parsing unextended [CommonMark](http://commonmark.org/),
  /// without inline HTML, and producing a document in the basic schema.
  //

  const defaultMarkdownParser = new MarkdownParser(
    schema,
    defaultTokenizer(),
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
      code: { mark: 'code' },
      // code_close: { mark: 'code' },
      html_block: { // TODO
        block: 'code_block',
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
    },
  );

  return defaultMarkdownParser.parse(content);
}
