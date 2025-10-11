import type Token from 'markdown-it/lib/token';

import type {
  ContextStash,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';
import { getInlineTokensHandlers } from './inline_token_handlers.ts';

export function getHtmlBasicTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    'heading_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`<${token.tag}>`, token);
      },
    ],
    'heading_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`</${token.tag}>\n`, token);
      },
    ],
    'paragraph_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<p>', token);
      },
    ],
    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</p>\n', token);
      },
    ],

    'fence': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<pre>' + token.content + '</pre>\n', token);
        // ctx.current.log('```' + token.info + '\n' + token.content + '```\n\n', token);
      },
    ],

    'code_block': [
      (token: Token, ctx: ContextStash) => {
        // ctx.current.log(
        //   token.content
        //     .split('\n')
        //     .map((t) => t ? ('    ' + t) : '')
        //     .join('\n') + '\n', token
        // );
      },
    ],

    'hr': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<hr />\n', token);
      },
    ],

    'html_block': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content, token);
      },
    ],
  };
}

function getHeaderTokensHandlers(): Record<string, Array<TokenHandler>> {
  const entriesBasic = Object.entries(getBasicTokensHandlers())
    .filter((entry) => ['heading_close'].includes(entry[0]));

  const entriesInline = Object.entries(getInlineTokensHandlers())
    .filter((entry) => ['text', 'link_open', 'link_close'].includes(entry[0]));

  return {
    ...Object.fromEntries(entriesInline),
    ...Object.fromEntries(entriesBasic),
    'default': [],
  };
}

export function getBasicTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'heading_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.handlers = getHeaderTokensHandlers();
        ctx.current.log('#'.repeat(+token.tag.slice(1)) + ' ', token);
      },
    ],
    'heading_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n', token);
        ctx.unstash();
      },
    ],
    'paragraph_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('', token);
        // Skip, as paragraphs are implied by newlines
      },
    ],
    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n', token);
        }
      },
    ],

    'fence': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(
          '```' + token.info + '\n' + token.content + '```\n\n',
          token,
        );
      },
    ],

    'code_block': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(
          token.content
            .split('\n')
            .map((t) => t ? ('    ' + t) : '')
            .join('\n') + '\n',
          token,
        );
      },
    ],

    'hr': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log((token.markup || '---') + '\n', token);
      },
    ],

    'html_block': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content, token);
      },
    ],
  };
}
