import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

export const addEmptyLines: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const tr = state.tr;

  const hardbreakType = state.schema.nodes.br;
  const softbreakType = state.schema.nodes.softbreak;

  function walk(
    nodes: readonly Node[],
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    let offset = 0;
    let occurredNotSoftBreak = false;

    for (let index = 0; index < nodes.length; index++) {
      const child = nodes[index];

      if ('image' === child.type.name) {
        if (index > 0) {
          const prevNode = nodes[index - 1];

          if (prevNode.type === softbreakType) {
          } else if (prevNode.type === hardbreakType) {
            tr.setNodeMarkup(
              tr.mapping.map(pos + offset - prevNode.nodeSize),
              softbreakType,
            );
          } else {
            const wbr = softbreakType.createAndFill();
            if (wbr) {
              tr.insert(
                tr.mapping.map(pos + offset),
                wbr,
              );
            }
          }
        }
      }
      if ('softbreak' === child.type.name) {
        const prevNode = nodes[index - 1];
        const nextNode = nodes[index + 1];

        if (prevNode?.type.name === 'softbreak') {
          tr.delete(
            tr.mapping.map(pos + offset),
            tr.mapping.map(pos + offset + child.nodeSize),
          );
        }
        if (prevNode?.textContent?.endsWith(' ')) {
          tr.delete(
            tr.mapping.map(pos + offset),
            tr.mapping.map(pos + offset + child.nodeSize),
          );
        }
        if (!occurredNotSoftBreak) {
          tr.delete(
            tr.mapping.map(pos + offset),
            tr.mapping.map(pos + offset + child.nodeSize),
          );
        }
      } else {
        occurredNotSoftBreak = true;
      }

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
