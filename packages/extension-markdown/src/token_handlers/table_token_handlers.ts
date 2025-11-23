import type { Token } from '../types.ts';

import type {
  ContextStash,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';
import { getInlineTokensHandlers } from './inline_token_handlers.ts';
import { TokenSource } from '../TokenSource.ts';

function getHtmlTableTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    // ...getHtmlBasicTokensHandlers(), // TODO html
    ...getInlineTokensHandlers(),

    'paragraph_open': [],
    'paragraph_close': [],

    'table_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash();
        ctx.current.meta['html_mode'] = true;
        ctx.current.log('<table>\n', token);
      },
    ],
    'table_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</table>\n', token);
        ctx.unstash();
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
          log('-'.repeat(columnsWidth[cellNo] - 1));

          if (cell.align === 'right') {
            log(':|');
          } else {
            log(' |');
          }
        }
        log('\n');
      }

      log('|');

      for (let cellNo = 0; cellNo < row.cells.length; cellNo++) {
        const cell = row.cells[cellNo];
        log(' '.repeat(1));
        for (const pair of cell.value) {
          log(pair[0], pair[1]);
        }
        const textLen: number = cell.value.reduce(
          (prev, current) => prev + current[0].length,
          0,
        );
        if (textLen < columnsWidth[cellNo]) {
          if (textLen === 0 && cell.startPos) {
            // textpos = cellpos + 1 (cell opening) + 1 (para opening)
            log(
              ' '.repeat(columnsWidth[cellNo] - textLen),
              { map: [cell.startPos + 2] } as Token,
            );
          } else {
            log(' '.repeat(columnsWidth[cellNo] - textLen));
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

function getMdTableTokensHandler(): Record<string, Array<TokenHandler>> {
  const rollbackTable = (
    token: Token,
    ctx: ContextStash,
    tokenSource: TokenSource<Token>,
  ) => {
    const rollbackPos = ctx.current.meta['table_rollback'];
    if (!ctx.current.meta['table_token_start']) {
      throw new Error('No table_token_start');
    }
    const outputPos = ctx.current.meta['table_output_pos'];
    if (!ctx.current.meta['table_output_pos']) {
      throw new Error('No table_output_pos');
    }

    tokenSource.rewind(ctx.current.meta['table_token_start']);

    ctx.rollback(rollbackPos);
    ctx.output.rollback(outputPos);

    ctx.stash();
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
          rollbackTable(token, ctx, tokenSource);
        }
      },
    ],

    'default': [
      rollbackTable,
    ],

    'table_open': [
      (token: Token, ctx: ContextStash, tokenSource: TokenSource<Token>) => {
        const rollbackPos = ctx.stash();
        ctx.current.meta['table_rollback'] = rollbackPos;
        ctx.current.meta['table_token_start'] = tokenSource.pos;
        ctx.current.meta['table_output_pos'] = ctx.output.chunkPos;
        ctx.current.metaObj['table_builder'] = new TableBuilder();
        ctx.current.handlers = getMdTableTokensHandler();
      },
    ],

    'table_close': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.render(ctx.current.log);
        ctx.unstash();
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
        const style = token.attrGet('style');
        const align = style === 'text-align:right' ? 'right' : 'left';

        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendCell(align, token);
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
        const style = token.attrGet('style');
        const align = style === 'text-align:right' ? 'right' : 'left';

        const tableBuilder: TableBuilder = ctx.current.metaObj['table_builder'];
        tableBuilder.appendCell(align, token);
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
