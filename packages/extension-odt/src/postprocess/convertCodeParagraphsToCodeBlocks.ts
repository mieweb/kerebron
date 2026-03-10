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

      const bookmarks: Node[] = [];

      for (let childNo = 0; childNo < node.childCount; childNo++) {
        const child = node.child(childNo);
        const monospaced = child.marks.some((mark) =>
          mark.type === markCodeType
        );
        const whitespaced = child.textContent.match(/^[ \t\u00A0]+$/);

        if (child.type.name === 'node_bookmark') {
          bookmarks.push(child);
          codeSize += child.nodeSize;
          continue;
        }

        if (child.type.name === 'br') {
          codeText += '\n';
          codeSize += child.nodeSize;
          continue;
        }

        if (monospaced || whitespaced) {
          codeText += child.text || child.textBetween(0, child.content.size);
          codeSize += child.nodeSize;
          continue;
        }

        break;
      }

      if (codeSize > 0) {
        const startPos = tr.mapping.map(pos);
        const endPos = tr.mapping.map(pos + 1 + codeSize);

        if (codeText.trim()) {
          const textNode = schema.text(codeText);
          const codeBlock = schema.nodes.code_block.createAndFill(null, [
            textNode,
          ]);

          if (codeBlock) {
            tr.replaceRangeWith(startPos, endPos, codeBlock);
          }
        } else {
          tr.replace(startPos, endPos);
        }
        for (const bookmark of bookmarks) {
          tr.insert(startPos, bookmark);
        }
      }

      if (codeSize > 0 && codeSize + 2 === node.nodeSize) {
        // tr.deleteRange(tr.mapping.map(pos), tr.mapping.map(pos))
      }
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
