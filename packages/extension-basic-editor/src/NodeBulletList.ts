import { NodeSpec, NodeType } from 'prosemirror-model';

import { CoreEditor, Node } from '@kerebron/editor';
import {
  type Commands,
  type CommandShortcuts,
  wrapInList,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';

export class NodeBulletList extends Node {
  override name = 'bullet_list';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ['ul', 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    /// Given a list node type, returns an input rule that turns a bullet
    /// (dash, plush, or asterisk) at the start of a textblock into a
    /// bullet list.
    return [
      wrappingInputRule(/^\s*([-+*])\s$/, type),
    ];
  }

  getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    return {
      'toggleBulletList': () => wrapInList(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-8': 'toggleBulletList',
    };
  }
}
