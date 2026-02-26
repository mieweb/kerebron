import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

// Related tests:
// test ./block-macro.md
export const fixParaEnding: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const tr = state.tr;

  const hardbreakType = state.schema.nodes.br;
  const paragraphType = state.schema.nodes.paragraph;

  function walk(
    nodes: readonly Node[],
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    if (parent.type === paragraphType) {
      let offset = parent.content.size;
      for (let index = nodes.length - 1; index >= 0; index--) {
        const child = nodes[index];
        if (child.type !== hardbreakType) {
          break;
        }
        offset -= child.nodeSize;

        const from = pos + offset;
        const to = from + child.nodeSize;
        tr.replace(tr.mapping.map(from), tr.mapping.map(to));
      }
      return;
    }

    let offset = 0;
    for (let index = 0; index < nodes.length; index++) {
      const child = nodes[index];

      walk(child.children, child, pos + offset + 1, depth + 1);

      offset += child.nodeSize;
    }
  }

  walk(doc.children, doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
