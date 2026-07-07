import { NodeSpec, NodeType } from 'prosemirror-model';

import { CoreEditor, Node } from '@kerebron/editor';
import { CommandFactories, CommandFactory } from '@kerebron/editor/commands';
import { EditorState, Transaction } from 'prosemirror-state';

export class NodeDocument extends Node {
  override name = 'doc';

  override getNodeSpec(): NodeSpec {
    return {
      content: 'block+',
      attrs: {
        meta: { default: null },
      },
      marks: 'code em strong link bookmark', // TODO: why is it necessary for convertCodeParagraphsToCodeBlocks?
      EMPTY_DOC: {
        'type': this.name,
        'content': [
          {
            'type': 'paragraph',
            'content': [],
          },
        ],
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const getMeta: CommandFactory = (cb: (meta: any) => void) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        cb(structuredClone(state.doc.attrs.meta));
        return true;
      };
    };

    const setMeta: CommandFactory = (meta: any) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;

        tr.setDocAttribute('meta', meta);

        if (dispatch) {
          dispatch(tr);
        }

        return tr.docChanged;
      };
    };

    const updateMeta: CommandFactory = (
      updater: (meta: unknown) => unknown,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;

        tr.setDocAttribute('meta', updater(state.doc.attrs.meta));

        if (dispatch) {
          dispatch(tr);
        }

        return tr.docChanged;
      };
    };
    return {
      getMeta,
      setMeta,
      updateMeta,
    };
  }
}
