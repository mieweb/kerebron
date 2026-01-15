import { Command } from 'prosemirror-state';

export const addEmptyLines: Command = (state, dispatch): boolean => {
  let tr = state.tr;

  state.doc.descendants((node, pos) => {
    if (['image'].includes(node.type.name)) {
      const $pos = state.doc.resolve(pos);
      const isFirstChild = $pos.index() === 0;
      if (isFirstChild) {
        return;
      }

      const br = state.schema.nodes.softbreak.createAndFill();
      if (br) {
        tr = tr.insert(
          tr.mapping.map(pos),
          br,
        );
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
