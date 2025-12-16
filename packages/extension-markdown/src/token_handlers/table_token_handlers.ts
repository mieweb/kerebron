import { Token } from '../types.ts';

import type {
  ContextStash,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';
import { getHtmlInlineTokensHandlers } from './inline_token_handlers.ts';
import { TokenSource } from '../TokenSource.ts';

export type TextAlign = 'left' | 'right';

function getHtmlTableTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    // ...getHtmlBasicTokensHandlers(), // TODO html
    ...getHtmlInlineTokensHandlers(),

    'paragraph_open': [],
    'paragraph_close': [
      (token: Token, ctx: ContextStash) => {
        // TODO only if not at the end of TD
        // if (ctx.output.colPos !== 0) {
        //   ctx.current.log('<br/ >\n', token);
        // }
      },
    ],

    'table_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash('getHtmlTableTokensHandlers.table_open');
        ctx.current.meta['html_mode'] = true;
        ctx.current.log('<table>\n', token);
      },
    ],
    'table_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</table>\n', token);
        ctx.unstash('getHtmlTableTokensHandlers.table_close');
      },
    ],
    'thead_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<thead>\n', token);
      },
    ],
    'thead_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</thead>\n', token);
      },
    ],
    'tr_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<tr>\n', token);
      },
    ],
    'tr_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</tr>\n', token);
      },
    ],
    'th_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<th>', token);
      },
    ],
    'th_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</th>\n', token);
      },
    ],
    'tbody_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<tbody>\n', token);
      },
    ],
    'tbody_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</tbody>\n', token);
      },
    ],
    'td_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<td>', token);
      },
    ],
    'td_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</td>\n', token);
      },
    ],
  };
}

interface TableCell {
  value: [string, Token][];
  align: 'left' | 'right';
  startPos?: number;
}

interface TableRow {
  type: 'header' | 'body';
  cells: Array<TableCell>;
}

class TableBuilder {
  private rows: Array<TableRow>;
  public currentType: 'header' | 'body';

  constructor() {
    this.currentType = 'body';
    this.rows = [];
  }

  appendRow() {
    this.rows.push({
      type: this.currentType,
      cells: [],
    });
  }

  appendCell(align: 'left' | 'right', token: Token) {
    const lastRow = this.rows[this.rows.length - 1];
    const startPos = token.map && token.map.length > 0 ? token.map[0] : 0;
    lastRow.cells.push({
      value: [],
      startPos,
      align,
    });
  }

  appendText(content: string, token: Token) {
    const lastRow = this.rows[this.rows.length - 1];
    if (lastRow.cells.length > 0) {
      lastRow.cells[lastRow.cells.length - 1].value.push([content, token]);
    }
  }

  render(log: (txt: string, token?: Token) => void) {
    let prevType = '';

    let lastHeader: Array<TableCell> = [];

    const columnsWidth: Array<number> = [];
    for (let rowNo = 0; rowNo < this.rows.length; rowNo++) {
      const row = this.rows[rowNo];
      for (let cellNo = 0; cellNo < row.cells.length; cellNo++) {
        while (columnsWidth.length <= cellNo) {
          columnsWidth.push(1);
        }
        const headCell = lastHeader[cellNo];
        const cell = row.cells[cellNo];
        const textLen: number = cell.value.reduce(
          (prev, current) => prev + current[0].length,
          0,
        );
        if (columnsWidth[cellNo] < textLen + 1) {
          columnsWidth[cellNo] = textLen + 1;
        }
      }
    }

    for (let rowNo = 0; rowNo < this.rows.length; rowNo++) {
      const row = this.rows[rowNo];

      if (prevType === 'header' && prevType !== row.type) {
        log('|');
        for (let cellNo = 0; cellNo < lastHeader.length; cellNo++) {
          const cell = lastHeader[cellNo];
          log(' ');

          if (cell.align === 'right') {
            log('-'.repeat(columnsWidth[cellNo] - 2));
            log(': |');
          } else {
            log('-'.repeat(columnsWidth[cellNo] - 1));
            log(' |');
          }
        }
        log('\n');
      }

      log('|');

      for (let cellNo = 0; cellNo < row.cells.length; cellNo++) {
        const cell = row.cells[cellNo];
        const textLen: number = cell.value.reduce(
          (prev, current) => prev + current[0].length,
          0,
        );

        if (cell.align === 'right') {
          if (textLen === 0 && cell.startPos) {
            log(
              ' '.repeat(columnsWidth[cellNo] - textLen),
              { map: [cell.startPos + 2] } as Token,
            );
          } else {
            log(' '.repeat(columnsWidth[cellNo] - textLen));
          }
        } else {
          log(' '.repeat(1));
        }
        for (const pair of cell.value) {
          log(pair[0], pair[1]);
        }
        if (textLen < columnsWidth[cellNo]) {
          if (cell.align === 'right') {
            log(' '.repeat(1));
          } else {
            if (textLen === 0 && cell.startPos) {
              log(
                ' '.repeat(columnsWidth[cellNo] - textLen),
                { map: [cell.startPos + 2] } as Token,
              );
            } else {
              log(' '.repeat(columnsWidth[cellNo] - textLen));
            }
          }
        }
        log('|');
      }

      log('\n');

      if (row.type === 'header') {
        lastHeader = row.cells;
      }
      prevType = row.type;
    }
  }
}

export interface RollbackData {
  sourcePos: number;
  outputPos: number;
  ctxDepth: number;
}

function getMdTableTokensHandler(): Record<string, Array<TokenHandler>> {
  const rollbackMdTable = (
    token: Token,
    ctx: ContextStash,
    tokenSource: TokenSource<Token>,
  ) => {
    if (!ctx.current.meta['html_rollback']) {
      throw new Error('No html_rollback');
    }

    const rollback: RollbackData = ctx.current.meta['html_rollback'];

    tokenSource.rewind(rollback.sourcePos);
    ctx.rollback(rollback.ctxDepth, 'rollbackMdTable, ' + token.type);
    ctx.output.rollback(rollback.outputPos);

    ctx.stash('getMdTableTokensHandler.rollbackTable');
    ctx.current.meta['html_mode'] = true;
    ctx.current.log('<table>\n', token);
    ctx.current.handlers = getHtmlTableTokensHandlers();
  };

  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendText(token.content, token);
      },
    ],

    'paragraph_open': [],
    'paragraph_close': [
      (token: Token, ctx: ContextStash, tokenSource: TokenSource<Token>) => {
        ctx.current.meta['table_cell_para_count'] =
          +ctx.current.meta['table_cell_para_count'] + 1;
        if (ctx.current.meta['table_cell_para_count'] > 1) { // Only 1 line in markdown pipe table
          rollbackMdTable(token, ctx, tokenSource);
        }
      },
    ],

    'default': [
      rollbackMdTable,
    ],

    'table_open': [
      (token: Token, ctx: ContextStash, tokenSource: TokenSource<Token>) => {
        const rollbackDepth = ctx.stash('getMdTableTokensHandler.table_open');
        if (!ctx.current.meta['html_rollback']) {
          const rollback: RollbackData = {
            sourcePos: tokenSource.pos,
            outputPos: ctx.output.chunkPos,
            ctxDepth: rollbackDepth,
          };
          ctx.current.meta['html_rollback'] = rollback;
        }

        ctx.current.metaObj['table_builder'] = new TableBuilder();
        ctx.current.handlers = getMdTableTokensHandler();
      },
    ],

    'table_close': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.render(ctx.current.log);
        ctx.unstash('getMdTableTokensHandler.table_close');
      },
    ],
    'thead_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.currentType = 'header';
      },
    ],
    'thead_close': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.currentType = 'body';
      },
    ],
    'tr_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendRow();
      },
    ],
    'tr_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'th_open': [
      (token: Token, ctx: ContextStash) => {
        // const style = token.attrGet('style');
        // const align = style === 'text-align:right' ? 'right' : 'left';
        const align = token.attrGet('align') || 'left';

        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendCell(align as TextAlign, token);
        ctx.current.meta['table_cell_para_count'] = 0;
      },
    ],
    'th_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'tbody_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.currentType = 'body';
      },
    ],
    'tbody_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'td_open': [
      (token: Token, ctx: ContextStash) => {
        const align = token.attrGet('align') || 'left';

        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendCell(align as TextAlign, token);
        ctx.current.meta['table_cell_para_count'] = 0;
      },
    ],
    'td_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
  };
}

export function getTableTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'table_open': getMdTableTokensHandler()['table_open'],
  };
}
