import type { Node } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';

export const removeUnusedBookmarks: Command = (state, dispatch): boolean => {
  const schema = state.schema;
  let tr = state.tr;

  const bookmarkNodeType = schema.nodes.node_bookmark;
  const bookmarkMarkType = schema.marks.bookmark;

  function walk(
    node: Node,
    pos = 0,
    depth = 0,
  ) {
    if (node.type === bookmarkNodeType) {
      console.log('del');
      tr = tr.delete(
        tr.mapping.map(pos - 1),
        tr.mapping.map(pos + node.nodeSize - 1),
      );
      return;
    }

    const newMarks = node.marks.filter((mark) =>
      mark.type !== bookmarkMarkType
    );
    if (newMarks.length !== node.marks.length) {
      tr = tr.setNodeMarkup(
        tr.mapping.map(pos),
        null,
        null,
        newMarks,
      );
    }

    node.forEach((child, offset, index) => {
      walk(child, pos + offset + 1, depth + 1);
    });
  }

  walk(state.doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
