import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';
import { toggleList } from './commands.ts';

export class NodeBulletList extends Node {
  override name = 'bullet_list';
  requires = ['doc'];

  override attributes = {
    toc: {
      default: undefined,
    },
    odtMarginLeft: {
      default: undefined,
    },
  };

  override getNodeSpec(): NodeSpec {
    return {
      content: 'list_item+',
      group: 'block list',
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

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const keepMarks = false;
    return {
      'toggleBulletList': () => {
        return toggleList('bullet_list', 'list_item', keepMarks);
      },
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-8': 'toggleBulletList',
    };
  }
}
