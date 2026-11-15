import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandShortcuts,
} from '@kerebron/editor/commands';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /** Replace the selection with a horizontal rule (`hr`) node, scrolling into view. */
    setHorizontalRule: () => ReturnType;
  }
}

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

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
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
}
