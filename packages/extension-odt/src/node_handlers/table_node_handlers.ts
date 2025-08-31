import { iterateChildren, NodeHandler, OdtStashContext } from '../OdtParser.ts';

export function getTableNodesHandlers(): Record<string, NodeHandler> {
  return {
    'table': (ctx: OdtStashContext, value: any) => {
      ctx.openNode();
      for (const item of value['table-row']) {
        ctx.handle('table-row', item);
      }
      ctx.closeNode('table');
    },
    'table-row': (ctx: OdtStashContext, value: any) => {
      ctx.openNode();
      for (const item of value['table-cell']) {
        ctx.handle('table-cell', item);
      }
      ctx.closeNode('table_row');
    },
    'table-cell': (ctx: OdtStashContext, value: any) => {
      ctx.openNode();
      iterateChildren(
        value.$value,
        (child) => ctx.handle(child.tag, child.value),
      );
      ctx.closeNode('table_cell');
    },
  };
}
