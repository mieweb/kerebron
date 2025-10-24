import { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';

export class NodeBlockquote extends Node {
  override name = 'blockquote';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return ['blockquote', 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      /// Given a blockquote node type, returns an input rule that turns `"> "`
      /// at the start of a textblock into a blockquote.
      wrappingInputRule(/^\s*>\s$/, type),
    ];
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'toggleBlockquote': () => editor.commandFactories.wrapInList(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Ctrl->': 'toggleBlockquote',
    };
  }
}
