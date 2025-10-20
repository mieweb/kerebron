import type { Token } from '../types.ts';

import type {
  ContextStash,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';

export function getFootnoteTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    'footnote_block_open': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'footnote_block_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],

    'footnote_open': [
      (token: Token, ctx: ContextStash) => {
        if (token.meta.label) {
          ctx.current.log(`[^${token.meta.label}]: `, token);
        } else {
          ctx.current.log(`[^footnote_${token.meta.id}]: `, token);
        }
        ctx.stash();
        ctx.current.footnoteCnt++;
        ctx.current.itemRow = 0;
      },
    ],
    'footnote_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
      },
    ],
    'footnote_anchor': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
  };
}
