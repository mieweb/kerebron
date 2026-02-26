import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

// Related tests:
// test ./confluence.md
// test ./example-document.md
export const trimLines: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  const tr = state.tr;

  const hardbreakType = state.schema.nodes.br;
  const softbreakType = state.schema.nodes.softbreak;
  const paragraphType = state.schema.nodes.paragraph;

  function walk(
    nodes: readonly Node[],
    parent: Node,
    pos = 0,
    depth = 0,
  ) {
    let offset = 0;

    function trimBeforeIndex(index: number, offset: number) {
      let to = pos + offset; // - child.nodeSize;
      for (let prev = index - 1; prev >= 0; prev--) {
        const prevNode = nodes[prev];
        if (prevNode?.type.name !== 'text') {
          break;
        }

        const text = prevNode.text || '';
        const rtrimed = text.replace(/[ \t\u00A0]+$/, '');
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

    let textWasOutputed = false;
    for (let index = 0; index < nodes.length; index++) {
      const child = nodes[index];

      if (child.isText) {
        let text = child.text || '';
        if (
          text.match(/^([ \t\u00A0]+)/) && !textWasOutputed &&
          paragraphType !== parent.type
        ) {
          text = text.replace(/^[ \t\u00A0]+/, '');
          const from = pos + offset;
          const to = from + child.nodeSize;

          if (text) {
            tr.replaceRangeWith(
              tr.mapping.map(from),
              tr.mapping.map(to),
              schema.text(text),
            );
          } else {
            tr.replace(tr.mapping.map(from), tr.mapping.map(to));
          }
        }

        if (text) {
          textWasOutputed = true;
        }
      }
      if (hardbreakType === child.type) {
        trimBeforeIndex(index, offset);
        if (
          index + 1 < nodes.length &&
          (nodes[index + 1].type === hardbreakType ||
            nodes[index + 1].type === softbreakType)
        ) {
          tr.setNodeMarkup(tr.mapping.map(pos + offset), softbreakType);
        }
      }

      walk(child.children, child, pos + offset + 1, depth + 1);

      offset += child.nodeSize;
    }

    trimBeforeIndex(nodes.length, offset);
  }

  walk(doc.children, doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
