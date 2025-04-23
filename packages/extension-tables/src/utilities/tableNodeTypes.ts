// Helper for creating a schema that supports tables.

import { NodeSpec, NodeType, Schema } from 'prosemirror-model';

/**
 * @public
 */
export type TableNodes = Record<
  'table' | 'table_row' | 'table_cell' | 'table_header',
  NodeSpec
>;

/**
 * @public
 */
export type TableRole = 'table' | 'row' | 'cell' | 'header_cell';

/**
 * @public
 */
export function tableNodeTypes(schema: Schema): Record<TableRole, NodeType> {
  let result = schema.cached.tableNodeTypes;
  if (!result) {
    result = schema.cached.tableNodeTypes = {};
    for (const name in schema.nodes) {
      const type = schema.nodes[name],
        role = type.spec.tableRole;
      if (role) result[role] = type;
    }
  }
  return result;
}
