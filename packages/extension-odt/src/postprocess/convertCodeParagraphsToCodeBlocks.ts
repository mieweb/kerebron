import { Node } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';

import type { Command } from '@kerebron/editor/commands';

export const convertCodeParagraphsToCodeBlocks: Command = (
  state,
  dispatch,
): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  let tr: Transaction = state.tr;

  const markCodeType = schema.marks.code;

  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      let codeText = '';
      let codeSize = 0;
      for (let childNo = 0; childNo < node.childCount; childNo++) {
        const child = node.child(childNo);

        if (child.type.name === 'br') {
          codeText += '\n';
          codeSize += child.nodeSize;
          continue;
        }

        if (child.marks.some((mark) => mark.type === markCodeType)) {
          codeText += child.text || child.textBetween(0, child.content.size);
          codeSize += child.nodeSize;
          continue;
        }

        break;
      }

      if (codeSize > 0) {
        const startPos = tr.mapping.map(pos);
        const endPos = tr.mapping.map(pos + 1 + codeSize);

        const textNode = schema.text(codeText);
        const codeBlock = schema.nodes.code_block.createAndFill(null, [
          textNode,
        ]);

        if (codeBlock) {
          tr = tr.replaceRangeWith(startPos, endPos, codeBlock);
        }
      }

      if (codeSize > 0 && codeSize + 2 === node.nodeSize) {
        // tr = tr.deleteRange(tr.mapping.map(pos), tr.mapping.map(pos))
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
