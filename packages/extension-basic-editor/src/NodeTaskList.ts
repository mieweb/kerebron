import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
  wrapInList,
} from '@kerebron/editor/commands';

export class NodeTaskList extends Node {
  override name = 'task_list';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: `ul[data-type="${this.name}"]` }],
      toDOM() {
        return ['ul', { 'data-type': this.name }, 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'toggleTaskList': () => wrapInList(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-9': 'toggleTaskList',
    };
  }
}
