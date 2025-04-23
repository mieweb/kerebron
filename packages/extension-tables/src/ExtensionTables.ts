import { Extension } from '@kerebron/editor';

import { NodeTable } from './NodeTable.ts';
import { NodeTableRow } from './NodeTableRow.ts';
import { NodeTableHeader } from './NodeTableHeader.ts';
import { NodeTableCell } from './NodeTableCell.ts';

export class ExtensionTables extends Extension {
  name = 'extension-tables';
  requires = [
    new NodeTable(),
    new NodeTableHeader(),
    new NodeTableRow(),
    new NodeTableCell(),
  ];
}
