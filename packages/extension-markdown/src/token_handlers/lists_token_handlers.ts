import type { Token } from '../types.ts';

import {
  type ContextStash,
  type TokenHandler,
  writeIndented,
} from '@kerebron/extension-markdown/MarkdownSerializer';
import {
  getHtmlInlineTokensHandlers,
  getInlineTokensHandlers,
} from './inline_token_handlers.ts';
import { TokenSource } from '../TokenSource.ts';
import { numberString } from '../utils.ts';

function getLongDefinitionTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    ...getInlineTokensHandlers(),

    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n');
        if (ctx.current.meta['para_hidden']) {
          ctx.current.itemSymbol = '';
        }
        ctx.current.itemRow++;
      },
    ],

    'code_block': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.current.itemRow === 0) {
          ctx.current.itemRow++;
        }

        if (ctx.output.colPos > 0) {
          ctx.current.log('\n');
        }
        if (!ctx.output.endsWith('\n\n')) {
          ctx.current.log('\n');
        }

        ctx.stash();
        ctx.current.log = (txt: string) => {
          writeIndented(ctx.output, txt, ctx.current);
        };

        ctx.current.log(
          token.content
            .split('\n')
            .map((t) => t.trim() ? ('  ' + t) : '')
            .join('\n') + '\n',
        );

        ctx.unstash();

        ctx.current.itemRow++;
      },
    ],

    'paragraph_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.meta['para_hidden'] = token.hidden;
      },
    ],
    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();

        if (ctx.output.colPos !== 0) {
          // ctx.current.log('\n');
        }
        ctx.current.itemRow++;
      },
    ],

    'dt_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.itemSymbol = '';
        ctx.current.itemRow = 0;
      },
    ],
    'dt_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'dd_open': [
      (token: Token, ctx: ContextStash) => {
        if (!ctx.output.endsWith('\n\n')) {
          ctx.current.log('\n');
        }
        ctx.current.itemSymbol = ':   ';
        ctx.current.itemRow = 0;
      },
    ],
    'dd_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],

    'dl_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.listLevel++;
        ctx.current.listType = 'dl';
      },
    ],
    'dl_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
      },
    ],
  };
}

function getShortDefinitionTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  const rollbackList = (
    token: Token,
    ctx: ContextStash,
    tokenSource: TokenSource<Token>,
  ) => {
    const rollbackPos = ctx.current.meta['def_rollback'];
    if (!ctx.current.meta['def_token_start']) {
      throw new Error('No def_token_start');
    }
    const outputPos = ctx.current.meta['def_output_pos'];
    if (!ctx.current.meta['def_output_pos']) {
      throw new Error('No def_output_pos');
    }

    tokenSource.rewind(ctx.current.meta['def_token_start']);

    ctx.rollback(rollbackPos);
    ctx.output.rollback(outputPos);

    ctx.stash();
    ctx.current.listLevel++;
    ctx.current.listType = 'dl';
    ctx.current.handlers = getLongDefinitionTokensHandlers();
  };

  return {
    'dl_open': [
      (token: Token, ctx: ContextStash, tokenSource: TokenSource<Token>) => {
        const rollbackPos = ctx.stash();
        ctx.current.meta['def_rollback'] = rollbackPos;
        ctx.current.meta['def_token_start'] = tokenSource.pos;
        ctx.current.meta['def_output_pos'] = ctx.output.chunkPos;
        ctx.current.listLevel++;
        ctx.current.listType = 'dl';
        ctx.current.handlers = getShortDefinitionTokensHandlers();
      },
    ],

    'dl_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
      },
    ],

    ...getInlineTokensHandlers(),

    'hardbreak': [
      rollbackList,
    ],
    'code_block': [
      rollbackList,
    ],

    'paragraph_open': [
      (token: Token, ctx: ContextStash) => {
        // Skip, as paragraphs are implied by newlines
      },
    ],
    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          // ctx.current.log('\n');
        }
      },
    ],

    'dt_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.itemSymbol = '';
        ctx.current.itemRow = 0;
      },
    ],
    'dt_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'dd_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.itemSymbol = '  ~ ';
        ctx.current.itemRow = 0;
      },
    ],
    'dd_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
  };
}

export function getListsTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'dl_open': getShortDefinitionTokensHandlers()['dl_open'],

    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n', token);
        }
        ctx.current.itemRow++;
      },
    ],

    'task_list_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.listLevel++;
        ctx.current.listType = 'tl';
        ctx.current.itemSymbol = '';
        ctx.current.itemNumber = 0;
      },
    ],
    'task_list_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'task_item_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.itemRow = 0;
        ctx.current.itemNumber++;

        ctx.current.itemSymbol = token.attrGet('checked') ? 'x' : '';

        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'task_item_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],

    'bullet_list_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.listLevel++;
        ctx.current.listType = 'ul';
        ctx.current.itemSymbol = '';
        ctx.current.itemNumber = 0;
      },
    ],
    'bullet_list_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'ordered_list_open': [
      (token: Token, ctx: ContextStash) => {
        {
          ctx.stash();
          ctx.current.listLevel++;
          ctx.current.listType = 'ol';

          const htmlInlineHandlers = Object.entries(
            getHtmlInlineTokensHandlers(),
          )
            .filter((a) =>
              [
                'strong_open',
                'strong_close',
                'em_open',
                'em_close',
                'underline_open',
                'underline_close',
                'strike_open',
                'strike_close',
              ].includes(
                a[0],
              )
            );

          ctx.current.handlers = {
            ...ctx.current.handlers,
            ...Object.fromEntries(htmlInlineHandlers),
          };

          ctx.current.itemSymbol = '';
          const symbol = token.attrGet('symbol');
          if (symbol) {
            ctx.current.meta['list_symbol'] = symbol;
          } else {
            ctx.current.meta['list_symbol'] = '1';
          }

          const start = token.attrGet('start');
          if (start) {
            ctx.current.itemNumber = (+start || 1) - 1;
          } else {
            ctx.current.itemNumber = 0;
          }
        }
      },
    ],
    'ordered_list_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'list_item_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.itemRow = 0;
        ctx.current.itemNumber++;

        ctx.current.itemSymbol = token.info || token.markup;
        if (!ctx.current.itemSymbol) {
          ctx.current.itemSymbol = numberString(
            ctx.current.itemNumber,
            ctx.current.meta['list_symbol'] || '1',
          );
        }

        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'list_item_close': [
      (token: Token, ctx: ContextStash) => {
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],

    'blockquote_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.blockquoteCnt++;
        if (ctx.output.colPos !== 0) {
          ctx.current.log('\n');
        }
      },
    ],
    'blockquote_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.unstash();
      },
    ],
  };
}
