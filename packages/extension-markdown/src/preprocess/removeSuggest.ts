import { Command, EditorState } from 'prosemirror-state';
import { NESTING_CLOSING, NESTING_OPENING, NodeAndPos } from '@kerebron/editor';

export const removeSuggest: Command = (state: EditorState, dispatch) => {
  const pairs: Record<string, [NodeAndPos?, NodeAndPos?]> = {};

  const tr = state.tr;
  const doc = state.doc;
  const type = 'comment';

  doc.descendants((node, pos) => {
    if (node.type.name === type && node.attrs.id) {
      const id = node.attrs.id;
      if (!pairs[id]) {
        pairs[id] = [];
      }
      if (node.attrs.nesting === NESTING_OPENING) {
        pairs[id][0] = { node, pos };
      }
      if (node.attrs.nesting === NESTING_CLOSING) {
        pairs[id][1] = { node, pos };
      }
    }
  });

  for (const id in pairs) {
    const open = pairs[id][0];
    const close = pairs[id][1];

    if (open && close) {
      const from = open.pos;
      const to = close.pos + close.node.nodeSize;
      tr.replace(tr.mapping.map(from), tr.mapping.map(to));
    }
  }

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
