import { Node, Schema } from 'prosemirror-model';
import { DOMParser } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { MdConfig } from '@kerebron/extension-markdown';
import { elementFromString } from '@kerebron/extension-basic-editor/ExtensionHtml';

import type { Token } from './types.ts';

import { MarkdownParser, type MarkdownParseState } from './MarkdownParser.ts';
import { sitterTokenizer } from './treeSitterTokenizer.ts';
import { YamlService } from '@kerebron/editor/yaml';

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
  if (!config.assetLoad) {
    throw new Error('No config.assetLoad');
  }

  const tokenizer = await sitterTokenizer(config.assetLoad);

  const defaultMarkdownParser = new MarkdownParser(
    schema,
    tokenizer,
    {
      frontmatter: {
        custom: (
          state: MarkdownParseState,
          token: Token,
        ) => {
          const topNode = state.stack[0];
          if (topNode?.type.name === 'doc') {
            const frontmatter = token.content;
            const end = frontmatter.indexOf('\n---\n', 4);
            if (frontmatter.startsWith('---\n') && end > -1) {
              const meta = config.yaml?.parse(frontmatter.substring(4, end)) ||
                undefined;
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

          state.importNodes(parsed.children);
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

  return state.doc;
}
