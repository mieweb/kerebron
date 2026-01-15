import { MarkType } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const removeMarkedContent: Command = (state, dispatch): boolean => {
  let tr = state.tr;

  const markType: MarkType = state.schema.marks.change;

  state.doc.descendants((node, pos) => {
    if (node.isText) {
      const hasMark = node.marks.some((mark) => mark.type === markType);
      tr = tr.deleteRange(
        tr.mapping.map(pos),
        tr.mapping.map(pos + node.nodeSize),
      );
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
