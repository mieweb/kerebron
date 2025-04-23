import { NodeSpec, NodeType } from 'prosemirror-model';
import { CoreEditor, Node } from '@kerebron/editor';
import { Commands, CommandShortcuts } from '@kerebron/editor/commands';

export class NodeHorizontalRule extends Node {
  override name = 'hr';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return ['hr'];
      },
    };
  }

  override getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    return {
      'setHorizontalRule': () => (state, dispatch) => {
        if (dispatch) {
          dispatch(
            state.tr.replaceSelectionWith(type.create()).scrollIntoView(),
          );
        }
        return true;
      },
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-_': 'setHorizontalRule',
    };
  }

  // TODO automerge
}
