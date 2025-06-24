import { Fragment, MarkType, Node, Schema } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const removeUnusedBookmarks: Command = (state, dispatch): boolean => {
  return false;
  function condition(mark) {
    console.log('rrrr', mark.type.name);
    return mark.type.name === 'bookmark';
  }

  if (node.marks) {
    // For text nodes, filter out the marks that match the condition
    const newMarks = node.marks.filter((mark) => !condition(mark));

    // If marks were removed, return a new text node with the remaining marks
    if (newMarks.length !== node.marks.length) {
      return node.mark(newMarks);
    }

    // Otherwise, return the original text node
    return node;
  }

  // if (Array.isArray(node.content)) {
  //   const content: Node[] = node.content.content.map(childNode => removeUnusedBookmarks(childNode));
  // return node.copy(content);
  // } else {
  // console.log('node.content', node.content);
  // }

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
