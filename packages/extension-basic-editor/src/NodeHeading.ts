import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  textblockTypeInputRule,
} from '@kerebron/editor/plugins/input-rules';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /** Set the textblock type to a level-1 heading. */
    setHeading1: () => ReturnType;
    /** Set the textblock type to a level-2 heading. */
    setHeading2: () => ReturnType;
    /** Set the textblock type to a level-3 heading. */
    setHeading3: () => ReturnType;
    /** Set the textblock type to a level-4 heading. */
    setHeading4: () => ReturnType;
    /** Set the textblock type to a level-5 heading. */
    setHeading5: () => ReturnType;
    /** Set the textblock type to a level-6 heading. */
    setHeading6: () => ReturnType;
  }
}

const maxLevel = 6;

export class NodeHeading extends Node {
  override name = 'heading';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node) {
        return ['h' + node.attrs.level, 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    /// Given a node type and a maximum level, creates an input rule that
    /// turns up to that number of `#` characters followed by a space at
    /// the start of a textblock into a heading whose level corresponds to
    /// the number of `#` signs.
    return [
      textblockTypeInputRule(
        new RegExp('^(#{1,' + maxLevel + '})\\s$'),
        type,
        (match) => ({ level: match[1].length }),
      ),
    ];
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const commands: Partial<CommandFactories> = {};

    for (let i = 1; i <= maxLevel; i++) {
      commands['setHeading' + i] = () =>
        editor.commandFactories.setBlockType(type, { level: i });
    }

    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const keys: Partial<CommandShortcuts> = {};

    for (let i = 1; i <= maxLevel; i++) {
      keys['Shift-Ctrl-' + i] = 'setHeading' + i;
    }

    return keys;
  }
}
