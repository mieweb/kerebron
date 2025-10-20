import { NESTING_CLOSING, type Token } from './types.ts';

import { getTableTokensHandlers } from './token_handlers/table_token_handlers.ts';
import { getBasicTokensHandlers } from './token_handlers/basic_token_handlers.ts';
import { getInlineTokensHandlers } from './token_handlers/inline_token_handlers.ts';
import { getFootnoteTokensHandlers } from './token_handlers/footnote_token_handlers.ts';
import { getListsTokensHandlers } from './token_handlers/lists_token_handlers.ts';
import { TokenSource } from './TokenSource.ts';
import { SmartOutput } from '@kerebron/editor/utilities';

export function writeIndented(
  output: SmartOutput<Token>,
  text: string,
  currentCtx: SerializerContext,
  token: Token,
) {
  const lines = text.split('\n');

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];

    if (output.colPos === 0 && line.length > 0) {
      output.log('> '.repeat(currentCtx.blockquoteCnt));
      output.log('    '.repeat(currentCtx.footnoteCnt));

      if (currentCtx.listType === 'tl') {
        output.log('    '.repeat(currentCtx.listLevel - 1));
        if (currentCtx.itemRow === 0) {
          output.log('- ');
          if (currentCtx.itemSymbol) {
            output.log('[x] ');
          } else {
            output.log('[ ] ');
          }
        } else {
          output.log('  ');
        }
      }
      if (currentCtx.listType === 'ul') {
        output.log('    '.repeat(currentCtx.listLevel - 1));
        if (currentCtx.itemRow === 0) {
          output.log(currentCtx.itemSymbol + ' ');
        } else {
          output.log('  ');
        }
      }
      if (currentCtx.listType === 'ol') {
        const no = currentCtx.itemSymbol;
        output.log('    '.repeat(currentCtx.listLevel - 1));
        if (currentCtx.itemRow === 0) {
          output.log(no);
        } else {
          output.log('    ');
        }
      }
      if (currentCtx.listType === 'dl') {
        if (currentCtx.itemSymbol) {
          if (currentCtx.itemRow === 0) {
            output.log(`${currentCtx.itemSymbol}`);
          } else {
            output.log(' '.repeat(currentCtx.itemSymbol.length));
          }
        }
      }
    }

    output.log(line, token);
    if (lineNo < lines.length - 1) {
      currentCtx.itemRow++;
      output.log('\n');
    }
  }
}

export interface SerializerContext {
  meta: Record<string, any>;
  metaObj: Record<string, any>;
  blockquoteCnt: number;
  footnoteCnt: number;
  listLevel: number;
  listType?: 'ul' | 'ol' | 'dl' | 'tl';
  itemRow: number;
  itemNumber: number;
  itemSymbol: string;

  handlers: Record<string, Array<TokenHandler>>;
  log: (txt: string, token: Token) => void;
}

export class ContextStash {
  private ctxStash: Array<SerializerContext> = [];
  private currentCtx: SerializerContext;
  public readonly output: SmartOutput<Token>;

  constructor(handlers: Record<string, Array<TokenHandler>>) {
    this.output = new SmartOutput();
    this.currentCtx = {
      meta: {},
      metaObj: {},
      blockquoteCnt: 0,
      footnoteCnt: 0,
      itemRow: 0,
      listLevel: 0,
      itemNumber: 0,
      itemSymbol: '',

      handlers,
      log: (txt: string, token: Token) => this.output.log(txt, token),
    };
    this.stash();
  }

  public stash(): number {
    this.ctxStash.push(this.currentCtx);
    const funcs = {
      log: this.currentCtx.log,
    };
    const handlers = { ...this.currentCtx.handlers };
    const metaObj = { ...this.currentCtx.metaObj };
    this.currentCtx = {
      ...structuredClone({
        ...this.currentCtx,
        log: undefined,
        handlers: undefined,
      }),
      metaObj,
      ...funcs,
      handlers: handlers,
    };

    const rollbackPos = this.ctxStash.length - 1;
    return rollbackPos;
  }

  public unstash() {
    const ctx = this.ctxStash.pop();
    if (!ctx) {
      throw new Error('Unstash failed');
    }
    this.currentCtx = ctx;
  }

  public rollback(rollbackPos: number) {
    const rollbackCtx = this.ctxStash[rollbackPos];
    if (!rollbackCtx) {
      throw new RangeError('Invalid rollbackPos: ' + rollbackPos);
    }

    this.ctxStash.splice(rollbackPos);
    this.currentCtx = this.ctxStash[this.ctxStash.length - 1];
  }

  get current() {
    return this.currentCtx;
  }
}

export function serializeInlineTokens(
  ctx: ContextStash,
  tokenSource: TokenSource<Token>,
  tokens: Token[],
) {
  const appendPos = tokenSource.append(tokens);
  const oldPos = tokenSource.pos;
  tokenSource.rewind(appendPos);

  try {
    tokenSource.iterate(appendPos, (token, i) => {
      const tokenHandlers: Array<TokenHandler> =
        ctx.current.handlers[token.type] || ctx.current.handlers['default'];
      if (!tokenHandlers) {
        throw new Error(
          `Unknown inline token: ${token.type} ` + JSON.stringify(token) +
            `, available hadlers: ${Object.keys(ctx.current.handlers)}`,
        );
      }

      for (const handler of tokenHandlers) {
        if (handler(token, ctx, tokenSource)) {
          break;
        }
      }

      if (tokenSource.pos + 1 < appendPos) {
        throw new RangeError('Rewinded before inline tokens');
      }
    });

    tokenSource.rewind(oldPos);
  } finally {
    tokenSource.trim(appendPos);
  }
}

export type TokenHandler = (
  token: Token,
  ctx: ContextStash,
  tokenSource: TokenSource<Token>,
) => boolean | void;

export class MarkdownSerializer {
  private ctx: ContextStash;

  constructor() {
    this.ctx = new ContextStash({
      ...getInlineTokensHandlers(),
      ...getTableTokensHandlers(),
      ...getBasicTokensHandlers(),
      ...getFootnoteTokensHandlers(),
      ...getListsTokensHandlers(),
    });
  }

  private get endsWithEmptyLine() {
    return this.ctx.output.endsWith('\n\n');
  }

  async serialize(tokens: Token[]): Promise<SmartOutput<Token>> {
    const prevLevelTokenType: Record<number, string> = {};

    const tokenSource = new TokenSource(tokens);
    tokenSource.iterate(0, (token, i) => {
      if (!this.ctx.current.meta['html_mode']) {
        if (token.level === 0 && token.nesting !== NESTING_CLOSING) {
          if (this.ctx.output.colPos !== 0) {
            this.ctx.current.log('\n');
          }
        }

        if (!this.endsWithEmptyLine) {
          if (token.nesting !== NESTING_CLOSING && token.level === 0) {
            const prevTopTokenType = prevLevelTokenType[token.level] || '';
            if (
              [
                'hr',
                'paragraph_close',
                'ordered_list_close',
                'bullet_list_close',
                'task_list_close',
                'dl_close',
                'table_close',
                'blockquote_close',
                'footnote_close',
                'code_block',
                'html_block',
              ].includes(prevTopTokenType)
            ) {
              this.ctx.current.log('\n');
            }
            if (
              'heading_close' === prevTopTokenType &&
              token.tag !== 'heading_open'
            ) {
              this.ctx.current.log('\n');
            }
          } else if (
            token.nesting !== NESTING_CLOSING && token.level === 1 &&
            'dt_open' === token.type
          ) {
            const prevTokenType = prevLevelTokenType[token.level] || '';
            if (
              [
                'dt_close',
                'dd_close',
              ].includes(prevTokenType)
            ) {
              this.ctx.current.log('\n');
            }
          }
        }
      }

      const tokenHandlers: Array<TokenHandler> =
        this.ctx.current.handlers[token.type] ||
        this.ctx.current.handlers['default'];
      if (token.type === 'inline') {
        if (token.children) {
          this.ctx.stash();
          this.ctx.current.log = (txt: string, token: Token) => {
            writeIndented(this.ctx.output, txt, this.ctx.current, token);
          };

          try {
            serializeInlineTokens(this.ctx, tokenSource, token.children);
            this.ctx.unstash();
          } catch (err: any) {
            if (err.message === 'Rewinded before inline tokens') {
              return;
            }
            throw err;
          }
        }
      } else if (!tokenHandlers) {
        throw new Error(
          `Unknown token: ${token.type} ` + JSON.stringify(token),
        );
      } else {
        for (const handler of tokenHandlers) {
          if (handler(token, this.ctx, tokenSource)) {
            break;
          }
        }
      }

      prevLevelTokenType[token.level] = token.type;
      if (token.nesting === NESTING_CLOSING) {
        prevLevelTokenType[token.level + 1] = '';
      }
    });

    return this.ctx.output;
  }
}
