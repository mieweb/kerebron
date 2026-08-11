import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const fixShortCodes: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  let tr = state.tr;

  const hardbreakType = state.schema.nodes.br;
  const softbreakType = state.schema.nodes.softbreak;

  if (!hardbreakType) {
    throw new Error('No hardbreak type in schema');
  }
  if (!softbreakType) {
    throw new Error('No softbreak type in schema');
  }

  function walk(
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    parent.forEach((child, offset, index) => {
      if ('shortcode_inline' === child.type.name) {
        if (index > 1) {
          const prevNode = parent.child(index - 1);
          if (prevNode.type === hardbreakType) {
            tr = tr.setNodeMarkup(
              pos + offset - prevNode.nodeSize,
              softbreakType,
            );
          }
        }
        if (index < parent.childCount - 1) {
          const nextNode = parent.child(index + 1);
          if (nextNode.type === hardbreakType) {
            tr = tr.setNodeMarkup(pos + offset + child.nodeSize, softbreakType);
          }
        }
      }
      walk(child, pos + offset + 1, depth + 1);
    });
  }

  walk(doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
