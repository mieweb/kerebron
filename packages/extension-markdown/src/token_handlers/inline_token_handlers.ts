import type Token from 'markdown-it/lib/token';

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
      },
    ],

    'link_close': [
      (token: Token, ctx: ContextStash) => {
        {
          const lastStackToken = ctx.current.meta['link_open_token'];
          const hrefTuple = lastStackToken.attrs?.find((attr) =>
            attr[0] === 'href'
          );
          const titleTuple = lastStackToken.attrs?.find((attr) =>
            attr[0] === 'title'
          );

          const href = hrefTuple ? hrefTuple[1] : '';
          const title = titleTuple ? ' "' + titleTuple[1] + '"' : '';

          if (ctx.current.meta['link_text'] === href && !title) {
            ctx.current.log(href, token);
          } else {
            ctx.current.log('[', token);
            ctx.current.log(
              escapeMarkdown(ctx.current.meta['link_text']),
              token,
            );
            ctx.current.log(`](${href}${title})`, token);
          }

          ctx.unstash();
        }
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
    's_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '~~', token);
      },
    ],
    's_close': [
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
      },
    ],

    'code_inline': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('`' + token.content + '`', token);
      },
    ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n', token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          const srcTuple = token.attrs?.find((attr) => attr[0] === 'src');
          // const altTuple = token.attrs?.find(attr => attr[0] === 'alt');
          let alt = '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }
          const titleTuple = token.attrs?.find((attr) => attr[0] === 'title');

          ctx.current.log(`![${alt}]`, token);
          if (srcTuple) {
            ctx.current.log(
              `(${srcTuple[1]}${titleTuple ? ' "' + titleTuple[1] + '"' : ''})`,
              token,
            );
          }
        }
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
    's_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    's_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`</${tag}>`, token);
      },
    ],

    'link_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();

        const hrefTuple = token.attrs?.find((attr) => attr[0] === 'href');
        const titleTuple = token.attrs?.find((attr) => attr[0] === 'title');

        const href = hrefTuple ? hrefTuple[1] : '';
        const title = titleTuple ? ' "' + titleTuple[1] + '"' : '';

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

    'code_inline': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'code';
        ctx.current.log(`<${tag}>`, token);
        ctx.current.log(token.content || '', token);
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'br';
        ctx.current.log(`<${tag} />`, token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          const srcTuple = token.attrs?.find((attr) => attr[0] === 'src');
          // const altTuple = token.attrs?.find(attr => attr[0] === 'alt');
          let alt = '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }
          const titleTuple = token.attrs?.find((attr) => attr[0] === 'title');

          // ctx.current.log(`![${alt}]`, token);
          // if (srcTuple) {
          //   ctx.current.log(
          //     `(${srcTuple[1]}${titleTuple ? ' "' + titleTuple[1] + '"' : ''})`, token
          //   );
          // }

          // TODO

          const tag = token.tag || 'img';
          ctx.current.log(`<${tag} />`, token);
        }
      },
    ],

    'footnote_ref': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
  };
}
