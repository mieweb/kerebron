import { Fragment, MarkType, Node } from 'prosemirror-model';
import { Command, Transaction } from 'prosemirror-state';

function onlyHasCodeMarkedText(
  paragraph: Node,
  codeMarkType: MarkType,
): boolean {
  if (paragraph.content.size === 0) {
    return paragraph.marks.some((mark) => mark.type.name === codeMarkType.name);
  }

  let allAreCodeMarked = true;

  paragraph.content.forEach((child) => {
    if (
      !child.isText ||
      !child.marks.some((mark) => mark.type.name === codeMarkType.name)
    ) {
      allAreCodeMarked = false;
    }
  });

  return allAreCodeMarked;
}

export const convertCodeParagraphsToCodeBlocks: Command = (
  state,
  dispatch,
): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  let tr: Transaction = state.tr;

  let paragraphsToMerge = null;

  function flushCodeBlock() {
    if (paragraphsToMerge === null) {
      return;
    }

    const textNode = schema.text(paragraphsToMerge.innerText);
    const codeBlock = schema.nodes.code_block.createAndFill(null, [textNode]);

    const startPos = tr.mapping.map(paragraphsToMerge.startPos);
    const endPos = tr.mapping.map(paragraphsToMerge.endPos);

    tr.replaceRangeWith(startPos, endPos, codeBlock);

    paragraphsToMerge = null;
  }

  function nodesToText(fragment: Fragment) {
    if (fragment.content.length === 0) {
      return '';
    }

    let retVal = '';

    fragment.content.forEach((node) => {
      if (node.isText) {
        retVal += node.text;
      } else {
        retVal = '@TODO: node.type ' + node.type;
      }
    });

    return retVal;
  }

  doc.forEach((node, pos) => {
    if (node.type.name === 'paragraph') {
      const isCodeOnly = onlyHasCodeMarkedText(node, schema.marks.code);
      const isEmpty = node.content.size === 0;

      if (isCodeOnly) {
        if (paragraphsToMerge === null) {
          paragraphsToMerge = {
            startPos: pos,
            endPos: pos + node.nodeSize,
            innerText: nodesToText(node.content),
          };
        } else {
          paragraphsToMerge = {
            startPos: paragraphsToMerge.startPos,
            endPos: pos + node.nodeSize,
            innerText: paragraphsToMerge.innerText + '\n' +
              nodesToText(node.content),
          };
        }
        return;
      }
    }

    if (paragraphsToMerge !== null) {
      flushCodeBlock();
    }
  });

  if (paragraphsToMerge !== null) {
    flushCodeBlock();
  }

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
