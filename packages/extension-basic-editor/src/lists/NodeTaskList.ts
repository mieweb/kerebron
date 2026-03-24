import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { toggleList } from './commands.ts';

export class NodeTaskList extends Node {
  override name = 'task_list';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'task_item+',
      group: 'block list',
      parseDOM: [{ tag: `ul[data-type="${this.name}"]` }],
      toDOM: () => {
        return ['ul', { 'data-type': this.name }, 0];
      },
    };
  }

  override getCommandFactories(): Partial<CommandFactories> {
    return {
      'toggleTaskList': () => {
        return toggleList('task_list', 'task_item');
      },
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-9': 'toggleTaskList',
    };
  }
}
