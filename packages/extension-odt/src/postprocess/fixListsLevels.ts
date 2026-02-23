import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

// Related tests:
// test ./example-document.md
export const fixListsLevels: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;

  const tr = state.tr;

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
