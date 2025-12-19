import { type CoreEditor, Extension } from '@kerebron/editor';
import { type EditorState, type Transaction } from 'prosemirror-state';
import { type CommandFactories } from '@kerebron/editor/commands';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * Extension that adds text alignment commands.
 * Works by setting a 'textAlign' attribute on block nodes that support it.
 */
export class ExtensionTextAlign extends Extension {
  name = 'textAlign';

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    const setAlignment = (align: TextAlign) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const { selection, tr } = state;
        const { from, to } = selection;

        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          // Check if this node type has a textAlign attribute
          if (
            node.isBlock &&
            node.type.spec.attrs &&
            'textAlign' in node.type.spec.attrs
          ) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              textAlign: align,
            });
            changed = true;
          }
        });

        if (changed && dispatch) {
          dispatch(tr);
        }
        return changed;
      };
    };

    return {
      setTextAlignLeft: () => setAlignment('left'),
      setTextAlignCenter: () => setAlignment('center'),
      setTextAlignRight: () => setAlignment('right'),
      setTextAlignJustify: () => setAlignment('justify'),
    };
  }
}
