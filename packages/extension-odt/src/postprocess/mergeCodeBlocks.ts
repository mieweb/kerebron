import { Command } from 'prosemirror-state';

const CODEBLOCK_START = ''; // gdocs
const CODEBLOCK_END = '';

// Related tests:
// test ./code-blocks.md
export const mergeCodeBlocks: Command = (state, dispatch): boolean => {
  const schema = state.schema;
  let tr = state.tr;

  const codeBlockType = schema.nodes.code_block;
  const paraBlockType = schema.nodes.paragraph;

  const parent = state.doc;
  let offset = 0;
  for (let nodeNo = 0; nodeNo < parent.childCount; nodeNo++) {
    const node = parent.nodeAt(offset);
    if (!node) {
      continue;
    }

    if (node.type !== codeBlockType) {
      offset += node.nodeSize;
      continue;
    }

    let codeTexts = [];
    let codeSize = 0;
    {
      codeSize += node.nodeSize;
      const text = node.text || node.textBetween(0, node.content.size);
      codeTexts.push(text.endsWith('\n') ? text : text + '\n');
    }

    let nextPos = offset + node.nodeSize;
    while (true) {
      const next = state.doc.nodeAt(nextPos);
      if (!next) {
        break;
      }

      const currentPos = nextPos;
      nextPos += next.nodeSize;

      if (next.type === paraBlockType && next.childCount === 0) {
        codeTexts.push('\n');
        codeSize += next.nodeSize;
        continue;
      }

      if (next.type === codeBlockType && node.attrs.lang === next.attrs.lang) {
        const text = next.text || next.textBetween(0, next.content.size);
        codeTexts.push(text.endsWith('\n') ? text : text + '\n');

        codeSize += next.nodeSize;
        continue;
      }

      break;
    }

    if (codeTexts.length > 1) {
      const startPos = tr.mapping.map(offset);
      const endPos = tr.mapping.map(offset + codeSize);

      const codeText = codeTexts.join('').replace(/\n+$/gm, '\n');
      const textNode = schema.text(codeText);
      const codeBlock = schema.nodes.code_block.createAndFill(null, [textNode]);

      if (codeBlock) {
        tr = tr.replaceRangeWith(startPos, endPos, codeBlock);
      }
    }

    offset += codeSize;
  }

  state.doc.descendants((node, pos) => {
    if (
      node.type === paraBlockType &&
      [CODEBLOCK_START, CODEBLOCK_END].includes(
        node.textBetween(0, node.content.size),
      )
    ) {
      tr = tr.deleteRange(
        tr.mapping.map(pos),
        tr.mapping.map(pos + node.nodeSize),
      );
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
