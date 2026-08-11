import { Command } from 'prosemirror-state';

export const removeEmptyTags: Command = (state, dispatch): boolean => {
  const paragraphType = state.schema.nodes.paragraph;
  const tr = state.tr;

  state.doc.descendants((node, pos) => {
    if (['paragraph'].includes(node.type.name)) {
      const onlyEmptyTexts = node.children.every((child) =>
        child.isText && child.textContent === ''
      );

      if (node.childCount === 0 || onlyEmptyTexts) {
        tr.deleteRange(
          tr.mapping.map(pos),
          tr.mapping.map(pos + node.nodeSize),
        );
      }
    } else if (['heading'].includes(node.type.name)) {
      const onlyHasBookmark = node.children.find((child) =>
        child.type.name === 'node_bookmark'
      );
      const onlyEmptyTexts = node.children.every((child) =>
        child.isText && child.textContent === '' ||
        child.type.name === 'node_bookmark'
      );

      if (onlyHasBookmark && onlyEmptyTexts) {
        tr.setNodeMarkup(tr.mapping.map(pos), paragraphType);
      } else {
        if (node.childCount === 0 || onlyEmptyTexts) {
          tr.deleteRange(
            tr.mapping.map(pos),
            tr.mapping.map(pos + node.nodeSize),
          );
        }
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
