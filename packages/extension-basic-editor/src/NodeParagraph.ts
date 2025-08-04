import { type NodeSpec, type NodeType } from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
  setBlockType,
} from '@kerebron/editor/commands';

export class NodeParagraph extends Node {
  override name = 'paragraph';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'setParagraph': () => setBlockType(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-0': 'setParagraph',
    };
  }
}
