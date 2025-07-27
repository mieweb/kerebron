import { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type Commands,
  type CommandShortcuts,
  setBlockType,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  textblockTypeInputRule,
} from '@kerebron/editor/plugins/input-rules';

export class NodeTableRow extends Node {
  override name = 'table_row';
  requires = ['table'];

  override getNodeSpec(): NodeSpec {
    return {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [];
  }

  override getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    const commands = {};

    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const keys = {};
    return keys;
  }
}
