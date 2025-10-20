import type { Token } from '../types.ts';

import type {
  ContextStash,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';

export function escapeMarkdown(text: string): string {
  const markdownChars = [
    { char: '\\', escape: '\\\\' },
    // { char: '*', escape: '\\*' },
    // { char: '_', escape: '\\_' },
    { char: '#', escape: '\\#' },
    // { char: '[', escape: '\\[' },
    // { char: ']', escape: '\\]' },
    // { char: '(', escape: '\\(' },
    // { char: ')', escape: '\\)' },
    // { char: '`', escape: '\\`' },
    // { char: '>', escape: '\\>' },
    { char: '<', escape: '\\<' },
    // { char: '.', escape: '\\.' },
    // { char: '!', escape: '\\!' },
    // { char: '|', escape: '\\|' },
    // { char: '{', escape: '\\{' },
    // { char: '}', escape: '\\}' },
    { char: '…', escape: '...' },
    { char: '©', escape: '(c)' },
    { char: '®', escape: '(r)' },
    { char: '™', escape: '(tm)' },
    { char: '±', escape: '+-' },
    { char: '—', escape: '---' },
  ];

  let escapedText = text;
  for (const { char, escape } of markdownChars) {
    escapedText = escapedText.replaceAll(char, escape);
  }

  return escapedText;
}

function getLinkTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.meta['link_text'] += token.content;
        if (token.content && !ctx.current.meta['link_token_token']) {
          ctx.current.meta['link_token_token'] = token;
        }
      },
    ],

    'link_close': [
      (token: Token, ctx: ContextStash) => {
        {
          const lastStackToken: Token = ctx.current.meta['link_open_token'];
          const href: string = lastStackToken.attrGet('href') || '';
          const title: string = lastStackToken.attrGet('title') || '';

          if (ctx.current.meta['link_text'] === href && !title) {
            ctx.current.log(href, token);
          } else {
            ctx.current.log('[', token);
            ctx.current.log(
              ctx.current.meta['link_text'],
              ctx.current.meta['link_token_token'],
            );
            ctx.current.log(`](${href}${title})`, token);
          }

          ctx.unstash();
        }
      },
    ],

    default: [
      (token: Token, ctx: ContextStash) => {
        // Ignore other stuff
        // TODO: images?
      },
    ],
  };
}

export function getInlineTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(escapeMarkdown(token.content), token);
      },
    ],
    'strong_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '**', token);
      },
    ],
    'strong_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '**', token);
      },
    ],
    'em_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '*', token);
      },
    ],
    'em_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '*', token);
      },
    ],
    'underline_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '_', token);
      },
    ],
    'underline_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '_', token);
      },
    ],
    'strike_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '~~', token);
      },
    ],
    'strike_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '~~', token);
      },
    ],

    'link_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();

        ctx.current.handlers = getLinkTokensHandlers();

        ctx.current.meta['link_open_token'] = token;
        ctx.current.meta['link_text'] = '';
        ctx.current.meta['link_token_token'] = null;
      },
    ],

    'code_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('`', token);
      },
    ],
    'code_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('`', token);
      },
    ],

    'code_inline': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('`' + token.content + '`', token);
      },
    ],

    'math': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('$' + token.content + '$', token);
      },
    ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n', token);
      },
    ],
    'softbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n', token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          const src = token.attrGet('src');
          let alt = '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }

          ctx.current.log(`![${alt}]`, token);
          if (src) {
            const title = token.attrGet('title');
            ctx.current.log(
              `(${src}${title ? ' "' + title + '"' : ''})`,
              token,
            );
          }
        }
      },
    ],

    'html_block': [
      (token: Token, ctx: ContextStash) => {
      },
    ],

    'footnote_ref': [
      (token: Token, ctx: ContextStash) => {
        if (token.meta.label) {
          ctx.current.log(`[^${token.meta.label}]`, token);
        } else {
          ctx.current.log(`[^footnote_${token.meta.id}]`, token);
        }
      },
    ],
  };
}

function escapeHtml(text: string) {
  return text; // TODO
}

export function getHtmlInlineTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(escapeHtml(token.content), token);
      },
    ],
    'strong_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strong';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'strong_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strong';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'em_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'em';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'em_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'em';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'strike_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'strike_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`</${tag}>`, token);
      },
    ],

    'link_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();

        const href = token.attrGet('href') || '';
        const titleValue = token.attrGet('title');

        const title = titleValue ? ' "' + titleValue + '"' : '';

        ctx.current.log(`<a href="${href}">`, token);
      },
    ],

    'link_close': [
      (token: Token, ctx: ContextStash) => {
        {
          ctx.current.log('</a>', token);
          ctx.unstash();
        }
      },
    ],

    'code_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'code';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'code_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'code';
        ctx.current.log(`<${tag}>`, token);
      },
    ],

    // 'code_inline': [
    //   (token: Token, ctx: ContextStash) => {
    //     const tag = token.tag || 'code';
    //     ctx.current.log(`<${tag}>`, token);
    //     ctx.current.log(token.content || '', token);
    //     ctx.current.log(`</${tag}>`, token);
    //   },
    // ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'br';
        ctx.current.log(`<${tag} />`, token);
      },
    ],
    'softbreak': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'br';
        ctx.current.log(`<${tag} />`, token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          // const src = token.attrGet('src');
          // const alt = token.attrGet('alt');
          let alt = '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }
          // const title = token.attrGet('title');

          // ctx.current.log(`![${alt}]`, token);
          // if (src) {
          //   ctx.current.log(
          //     `(${src}${title ? ' "' + title + '"' : ''})`, token
          //   );
          // }

          // TODO

          const tag = token.tag || 'img';
          ctx.current.log(`<${tag} />`, token);
        }
      },
    ],
    'html_block': [
      (token: Token, ctx: ContextStash) => {
      },
    ],

    'footnote_ref': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
  };
}
