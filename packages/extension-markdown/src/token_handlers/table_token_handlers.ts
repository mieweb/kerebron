import type Token from 'markdown-it/lib/token';

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
        ctx.current.log('<table>\n');
      },
    ],
    'table_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</table>\n');
        ctx.unstash();
      },
    ],
    'thead_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<thead>\n');
      },
    ],
    'thead_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</thead>\n');
      },
    ],
    'tr_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<tr>\n');
      },
    ],
    'tr_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</tr>\n');
      },
    ],
    'th_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<th>');
      },
    ],
    'th_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</th>\n');
      },
    ],
    'tbody_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<tbody>\n');
      },
    ],
    'tbody_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</tbody>\n');
      },
    ],
    'td_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('<td>');
      },
    ],
    'td_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('</td>\n');
      },
    ],
  };
}

interface TableCell {
  text: string;
  align: 'left' | 'right';
}

interface TableRow {
  type: 'header' | 'body';
  cells: Array<TableCell>;
}

class TableBuilder {
  private rows: Array<TableRow>;
  public currentType: 'header' | 'body';

  currentCell: TableCell;

  constructor() {
    this.currentType = 'body';
    this.rows = [];
    this.currentCell = { text: '', align: 'left' };
  }

  appendRow() {
    this.rows.push({
      type: this.currentType,
      cells: [],
    });
  }

  appendCell(align: 'left' | 'right') {
    const lastRow = this.rows[this.rows.length - 1];
    lastRow.cells.push({
      text: '',
      align,
    });
    this.currentCell = lastRow.cells[lastRow.cells.length - 1];
  }

  render() {
    let result = '';

    let prevType = '';

    let lastHeader: Array<TableCell> = [];

    for (let rowNo = 0; rowNo < this.rows.length; rowNo++) {
      const row = this.rows[rowNo];

      if (prevType === 'header' && prevType !== row.type) {
        result += '|';
        for (const cell of lastHeader) {
          result += ' ';
          result += '-'.repeat(cell.text.length);

          if (cell.align === 'right') {
            result += ':|';
          } else {
            result += ' |';
          }
        }
        result += '\n';
      }

      result += '|';

      for (let cellNo = 0; cellNo < row.cells.length; cellNo++) {
        const headCell = lastHeader[cellNo];
        const cell = row.cells[cellNo];
        result += ' ';
        result += cell.text;
        if (headCell && cell.text.length < headCell.text.length) {
          result += ' '.repeat(headCell.text.length - cell.text.length);
        }
        result += ' |';
      }

      result += '\n';

      if (row.type === 'header') {
        lastHeader = row.cells;
      }
      prevType = row.type;
    }

    return result;
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
    ctx.current.log('<table>\n');
    ctx.current.handlers = getHtmlTableTokensHandlers();
  };

  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.currentCell.text += token.content;
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
        ctx.current.meta['table_builder'] = new TableBuilder();
        ctx.current.handlers = getMdTableTokensHandler();
      },
    ],

    'table_close': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        ctx.current.log(tableBuilder.render());
        ctx.unstash();
      },
    ],
    'thead_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.currentType = 'header';
      },
    ],
    'thead_close': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.currentType = 'body';
      },
    ],
    'tr_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.appendRow();
      },
    ],
    'tr_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'th_open': [
      (token: Token, ctx: ContextStash) => {
        const styleTuple = token.attrs?.find((attr) => attr[0] === 'style');
        const align = styleTuple && styleTuple[1] === 'text-align:right'
          ? 'right'
          : 'left';

        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.appendCell(align);
      },
    ],
    'th_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'tbody_open': [
      (token: Token, ctx: ContextStash) => {
        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.currentType = 'body';
      },
    ],
    'tbody_close': [
      (token: Token, ctx: ContextStash) => {
      },
    ],
    'td_open': [
      (token: Token, ctx: ContextStash) => {
        const styleTuple = token.attrs?.find((attr) => attr[0] === 'style');
        const align = styleTuple && styleTuple[1] === 'text-align:right'
          ? 'right'
          : 'left';

        const tableBuilder: TableBuilder = ctx.current.meta['table_builder'];
        tableBuilder.appendCell(align);
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
