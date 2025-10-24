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

export class NodeDefinitionList extends Node {
  override name = 'dl';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'dt+|dd+',
      group: 'block',
      parseDOM: [{ tag: 'dl' }],
      toDOM() {
        return ['dl', 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      // wrappingInputRule(/^\s*([-+*])\s$/, type),
    ];
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'toggleDefinitionList': () => editor.commandFactories.wrapInList(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {};
  }
}
