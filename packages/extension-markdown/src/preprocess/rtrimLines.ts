import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const rtrimLines: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  const tr = state.tr;

  const hardbreakType = state.schema.nodes.br;

  function walk(
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    let offset = 0;
    for (let index = 0; index < parent.children.length; index++) {
      const child = parent.children[index];

      if (hardbreakType === child.type) {
        let to = pos + offset; // - child.nodeSize;

        for (let prev = index - 1; prev >= 0; prev--) {
          const prevNode = parent.children[prev];
          if (prevNode?.type.name !== 'text') {
            break;
          }

          const text = prevNode.text || '';
          const rtrimed = text.replace(/\s+$/, '');
          if (rtrimed !== text) {
            const from = to - prevNode.nodeSize;
            if (rtrimed.length > 0) {
              tr.replaceRangeWith(
                tr.mapping.map(from),
                tr.mapping.map(to),
                schema.text(rtrimed),
              );
            } else {
              tr.replace(tr.mapping.map(from), tr.mapping.map(to));
            }
          } else {
            break;
          }
          to -= prevNode.nodeSize;
          break;
        }
      }

      walk(child, pos + offset + 1, depth + 1);

      offset += child.nodeSize;
    }
  }

  walk(doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
