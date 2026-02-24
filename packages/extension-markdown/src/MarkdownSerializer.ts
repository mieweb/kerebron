import { NESTING_CLOSING, Token } from './types.ts';

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
  token?: Token,
) {
  const lines = text
    .split('\n');

  const typeIndent: Record<ListType, number> = {
    ul: 2,
    ol: 4,
    dl: 2,
    tl: 4,
  };

  let offset = 0;
  const startPos = token
    ? (token.map && token.map.length > 0 ? token.map[0] : 0)
    : 0;
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];

    if (lineNo === lines.length - 1 && line.length === 0) {
      continue;
    }

    let prefix = '';

    if (output.colPos === 0) {
      prefix += '> '.repeat(currentCtx.blockquoteCnt);
    }
    if (output.colPos === 0 && line.length > 0) {
      prefix += '    '.repeat(currentCtx.footnoteCnt);

      const indent = currentCtx.listPath
        .slice(0, currentCtx.listPath.length - 1)
        .map((type) => typeIndent[type])
        .reduce((p, c) => p + c, 0);

      switch (currentCtx.listType) {
        case 'tl':
          prefix += ' '.repeat(indent);
          if (currentCtx.itemRow === 0) {
            prefix += '- ';
            if (currentCtx.itemSymbol) {
              prefix += '[x] ';
            } else {
              prefix += '[ ] ';
            }
          } else {
            prefix += '  ';
          }
          break;

        case 'ul':
          prefix += ' '.repeat(indent);
          if (currentCtx.itemRow === 0) {
            prefix += currentCtx.itemSymbol + ' ';
          } else {
            prefix += '  ';
          }
          break;

        case 'ol':
          prefix += ' '.repeat(indent);
          if (currentCtx.itemRow === 0) {
            prefix += currentCtx.itemSymbol;
          } else {
            prefix += ' '.repeat(4);
          }
          break;

        case 'dl':
          if (currentCtx.itemSymbol) {
            if (currentCtx.itemRow === 0) {
              prefix += `${currentCtx.itemSymbol}`;
            } else {
              prefix += ' '.repeat(currentCtx.itemSymbol.length);
            }
          }
          break;
      }
    }

    const tok = structuredClone(token);
    if (startPos && tok) {
      tok.map = [startPos + offset];
    }

    if (line.length > 0) {
      if (
        currentCtx.blockquoteCnt > 0 &&
        output.colPos === currentCtx.blockquoteCnt * 2 - 1
      ) {
        prefix += ' ';
      }
    }

    const isLastLine = lineNo >= lines.length - 1;

    const regex = new RegExp(currentCtx.lineBreak + '$');
    const hasBreak = line.match(new RegExp(currentCtx.lineBreak + '$'));
    const rightTrimmed = line
      .replace(regex, '')
      .replace(/[ \t\u00A0]+$/g, '');

    if (isLastLine) {
      if (hasBreak) {
        output.log(rightTrimmed ? prefix : prefix.trim());
        output.log(rightTrimmed + (hasBreak ? '  ' : ''), tok);
        offset += (rightTrimmed + (hasBreak ? '  ' : '')).length;
      } else {
        output.log(line ? prefix : prefix.trim());
        output.log(line, tok);
        offset += line.length;
      }
    } else {
      output.log(rightTrimmed ? prefix : prefix.trim());
      output.log(rightTrimmed + (hasBreak ? '  ' : ''), tok);
      offset += (rightTrimmed + (hasBreak ? '  ' : '')).length;
    }

    if (!isLastLine) {
      currentCtx.itemRow++;
      const tok = structuredClone(token);
      if (startPos && tok) {
        tok.map = [startPos + offset];
      }
      output.log('\n', tok);
      offset++;
    }
  }
}

type ListType = 'ul' | 'ol' | 'dl' | 'tl';

export interface SerializerContext {
  lineBreak: string;
  level: number;
  meta: Record<string, any>;
  metaObj: Record<string, any>;
  blockquoteCnt: number;
  footnoteCnt: number;
  listPath: Array<ListType>;
  listType?: ListType;
  itemRow: number;
  itemNumber: number;
  itemSymbol: string;

  handlers: Record<string, Array<TokenHandler>>;
  log: (txt: string, token?: Token) => void;
  debug: (...args: any[]) => void;
}

export class ContextStash {
  private ctxStash: Array<SerializerContext> = [];
  private currentCtx: SerializerContext;
  public readonly output: SmartOutput<Token>;

  constructor(handlers: Record<string, Array<TokenHandler>>) {
    this.output = new SmartOutput();
    this.currentCtx = {
      lineBreak: '\r',
      meta: {},
      metaObj: {},
      blockquoteCnt: 0,
      footnoteCnt: 0,
      itemRow: 0,
      listPath: [],
      itemNumber: 0,
      itemSymbol: '',

      handlers,
      log: (txt: string, token?: Token) => this.output.log(txt, token),
      debug: () => {},
      level: 0,
    };
    this.stash('ContextStash.constructor()');
  }

  public stash(reason: string): number {
    this.currentCtx.debug(
      '  '.repeat(this.ctxStash.length) + 'stash: ' + reason,
    );
    this.ctxStash.push(this.currentCtx);
    const funcs = {
      log: this.currentCtx.log,
      debug: this.currentCtx.debug,
    };
    const handlers = { ...this.currentCtx.handlers };
    const metaObj = { ...this.currentCtx.metaObj };
    this.currentCtx = {
      ...structuredClone({
        ...this.currentCtx,
        log: undefined,
        debug: undefined,
        handlers: undefined,
      }),
      metaObj,
      ...funcs,
      handlers: handlers,
      level: this.currentCtx.level + 1,
    };

    const rollbackPos = this.ctxStash.length - 1;
    return rollbackPos;
  }

  public unstash(reason: string) {
    const ctx = this.ctxStash.pop();
    this.currentCtx.debug(
      '  '.repeat(this.ctxStash.length) + 'unstash: ' + reason,
    );
    if (!ctx) {
      throw new Error('Unstash failed');
    }
    this.currentCtx = ctx;
  }

  public rollback(rollbackPos: number, reason: string) {
    const rollbackCtx = this.ctxStash[rollbackPos];
    if (!rollbackCtx) {
      throw new RangeError('Invalid rollbackPos: ' + rollbackPos);
    }

    this.currentCtx.debug('rollback ' + reason, rollbackPos);
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

export interface MarkdownSerializerConfig {
  debug?: (...args: any[]) => void;
}

export class MarkdownSerializer {
  private ctx: ContextStash;

  constructor(config: MarkdownSerializerConfig = {}) {
    this.ctx = new ContextStash({
      ...getInlineTokensHandlers(),
      ...getTableTokensHandlers(),
      ...getBasicTokensHandlers(),
      ...getFootnoteTokensHandlers(),
      ...getListsTokensHandlers(),
    });

    if (config.debug) {
      this.ctx.current.debug = config.debug;
    }
  }

  private get endsWithEmptyLine() {
    return this.ctx.output.endsWith('\n\n');
  }

  serialize(tokens: Token[]): SmartOutput<Token> {
    const prevLevelTokenType: Record<number, Token> = {};

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
            const prevTopToken = prevLevelTokenType[token.level];
            const prevTopTokenType = prevTopToken?.type || '';

            if (
              prevTopTokenType &&
              prevTopToken.attrGet('margin_after') &&
              token.attrGet('margin_before')
            ) {
              const bothLists = prevTopToken.type.endsWith('_list_close') &&
                token.type.endsWith('_list_open');
              const bothBulletLists =
                prevTopToken.type === 'bullet_list_close' &&
                token.type === 'bullet_list_open';
              const listNone = token.attrGet('first_level_type') === 'none';
              const prevListNone =
                prevTopToken?.attrGet('first_level_type') === 'none';

              if (
                (!listNone && !prevListNone && !bothBulletLists) || !bothLists
              ) {
                this.ctx.current.log('\n');
              }
            }
          } else if (
            token.nesting !== NESTING_CLOSING && token.level === 1 &&
            'dt_open' === token.type
          ) {
            const prevToken = prevLevelTokenType[token.level];
            const prevTokenType = prevToken?.type || '';
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

      if (token.nesting !== NESTING_CLOSING && token.level > 0) {
        const prevTopToken = prevLevelTokenType[token.level];
        const prevTopTokenType = prevTopToken?.type || '';
        if (
          [
            'paragraph_close',
          ].includes(prevTopTokenType)
        ) {
          if (this.ctx.current.blockquoteCnt === token.level) {
            writeIndented(this.ctx.output, '\n', this.ctx.current, token);
          }
        }
      }

      const tokenHandlers: Array<TokenHandler> =
        this.ctx.current.handlers[token.type] ||
        this.ctx.current.handlers['default'];
      if (token.type === 'inline') {
        if (token.children) {
          this.ctx.stash('serializeInlineTokens()');
          this.ctx.current.log = (txt: string, token?: Token) => {
            writeIndented(this.ctx.output, txt, this.ctx.current, token);
          };

          try {
            serializeInlineTokens(this.ctx, tokenSource, token.children);
            this.ctx.output.rtrim();
            this.ctx.unstash('serializeInlineTokens()');
          } catch (err: any) {
            this.ctx.current.debug(err.message);
            if (err.message === 'Rewinded before inline tokens') {
              return;
            }
            throw err;
          }
        }
      } else if (!tokenHandlers) {
        this.ctx.current.debug(
          'current.handlers',
          Object.keys(this.ctx.current.handlers).sort(),
        );
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

      prevLevelTokenType[token.level] = token;
      if (token.nesting === NESTING_CLOSING) {
        prevLevelTokenType[token.level + 1] = new Token('', '', token.nesting);
      }
    });

    return this.ctx.output;
  }
}
