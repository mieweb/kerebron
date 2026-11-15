import { NodeSpec, NodeType } from 'prosemirror-model';

import { CoreEditor, Node } from '@kerebron/editor';
import { CommandFactories, CommandFactory } from '@kerebron/editor/commands';
import { EditorState, Transaction } from 'prosemirror-state';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Read the document's `meta` attribute.
     *
     * @param cb Called with a structured clone of the current `meta` value.
     */
    getMeta: (cb: (meta: any) => void) => ReturnType;
    /**
     * Replace the document's `meta` attribute.
     *
     * @param meta New `meta` value.
     */
    setMeta: (meta: any) => ReturnType;
    /**
     * Update the document's `meta` attribute in place.
     *
     * @param updater Receives the current `meta`, returns the new one.
     */
    updateMeta: (updater: (meta: unknown) => unknown) => ReturnType;
  }
}

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
