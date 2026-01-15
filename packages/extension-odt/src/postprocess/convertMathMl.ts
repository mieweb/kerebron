import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

// Related tests:
// test ./example-document.md
export const convertMathMl: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  const mathType = schema.nodes.math;
  const codeBlockType = schema.nodes.code_block;

  if (!mathType || !codeBlockType) {
    return false;
  }

  let modified = false;

  const tr = state.tr;

  doc.forEach((parentNode, offset, index) => {
    if (parentNode.childCount !== 1) {
      return;
    }

    const parentPos = offset;

    const node = parentNode.child(0);

    if (node.type !== mathType) return;
    if (node.attrs.content.length === 0) return;

    const codeBlock = codeBlockType.create(
      {
        lang: node.attrs.lang,
      },
      schema.text(node.attrs.content),
    );

    tr.replaceWith(
      tr.mapping.map(parentPos),
      tr.mapping.map(parentPos + parentNode.nodeSize),
      codeBlock,
    );

    modified = true;
  });

  if (!modified) return false;

  if (dispatch) {
    dispatch(tr);
  }

  return true;
};
