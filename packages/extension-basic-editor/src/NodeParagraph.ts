import { type NodeSpec, type NodeType } from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type Commands,
  type CommandShortcuts,
  setBlockType,
} from '@kerebron/editor/commands';

export class NodeParagraph extends Node {
  override name = 'paragraph';
  requires = ['doc'];

  automerge = {
    block: 'paragraph',
  };

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

  override getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
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
