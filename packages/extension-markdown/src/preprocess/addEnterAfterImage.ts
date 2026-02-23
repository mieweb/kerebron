import { Fragment, Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const addEnterAfterImage: Command = (state, dispatch): boolean => {
  const tr = state.tr;

  const imageType = state.schema.nodes.image;

  const hardbreakType = state.schema.nodes.br;
  const softbreakType = state.schema.nodes.softbreak;

  function walk(
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    parent.forEach((child, offset, index) => {
      if (child.type !== imageType) {
        return;
      }

      const nextNode = parent.nodeAt(index + 1);
      if (
        nextNode?.type === hardbreakType && nextNode?.type === softbreakType
      ) {
        return;
      }

      const from = pos + offset + child.nodeSize;
      tr.insert(
        tr.mapping.map(from),
        Fragment.from([
          state.schema.node('softbreak'),
          state.schema.node('softbreak'),
        ]),
      );

      walk(child, pos + offset + 1, depth + 1);
    });
  }

  walk(state.doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
