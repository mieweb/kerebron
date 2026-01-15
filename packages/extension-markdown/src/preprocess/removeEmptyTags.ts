import { Command } from 'prosemirror-state';

export const removeEmptyTags: Command = (state, dispatch): boolean => {
  let tr = state.tr;

  state.doc.descendants((node, pos) => {
    if (['paragraph', 'heading'].includes(node.type.name)) {
      if (node.childCount === 0) {
        tr = tr.deleteRange(
          tr.mapping.map(pos),
          tr.mapping.map(pos + node.nodeSize),
        );
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
