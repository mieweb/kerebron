import { Fragment, Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const insertToc: Command = (state, dispatch): boolean => {
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

  doc.forEach((child, offset, index) => {
    if ('bullet_list' === child.type.name) {
      if (child.attrs.toc) {
        const copy = child.copy(
          Fragment.from(child.content),
        );
        tr.insert(0, copy);
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
