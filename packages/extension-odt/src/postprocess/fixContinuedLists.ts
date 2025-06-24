import { Fragment, Node, Slice } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

import { nodeToTreeString } from '@kerebron/editor';

const ANY_LIST = ['ordered_list', 'bullet_list'];

interface ListPos {
  start: number;
  end: number;
  stitchingDepth: number;
}

function getListEndingMaxDepth(list: Node | null): number {
  if (!list) {
    return 0;
  }

  if (ANY_LIST.indexOf(list.type.name) === -1) {
    return 0;
  }

  if (list.lastChild?.type.name === 'list_item') {
    return 1 + getListEndingMaxDepth(list.lastChild?.lastChild);
  }

  return 0;
}

function convertToStitchingLevels(list: Node, array: Array<Slice> = []) {
  if (ANY_LIST.indexOf(list.type.name) === -1) {
    throw new Error(`Incorrect list type: ${list.type.name}`);
  }

  if (!list?.firstChild) {
    return array;
  }

  const firstChildParagraph = list.firstChild.firstChild;

  if (firstChildParagraph?.content.size === 0) {
    if (list?.firstChild.children.length < 2) {
      array.push(new Slice(Fragment.from([]), 0, 0));
      // array.push(list.slice(list.firstChild.nodeSize, list.firstChild.nodeSize)) // empty slice
      return array;
    }

    const subList = list?.firstChild.child(1);

    array.push(list.slice(list.firstChild.nodeSize, list.content.size));

    if (ANY_LIST.indexOf(subList?.type.name) > -1) {
      convertToStitchingLevels(subList, array);
    }
  } else {
    array.push(list.slice(0, list.content.size));
  }

  return array;
}

export const fixContinuedLists: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  let tr = state.tr;

  let previousList: ListPos | null = null;

  // console.debug(nodeToTreeString(doc));

  doc.forEach((child, childPos) => {
    if (child.type.name === 'ordered_list') {
      const start = childPos;
      const end = start + child.nodeSize;

      if (previousList) {
        console.log('xxxxx');
        console.debug(nodeToTreeString(child));

        const stitchingLevels = convertToStitchingLevels(child);

        if (stitchingLevels.length <= previousList.stitchingDepth) {
          const betweenStart = previousList.end;
          const betweenNodes = doc.slice(betweenStart, start);

          tr = tr.delete(tr.mapping.map(betweenStart), tr.mapping.map(end));

          let posToInsert = tr.mapping.map(previousList.end);
          for (const level of stitchingLevels) {
            posToInsert -= 1; // Before /OL token
            tr = tr.replace(posToInsert, posToInsert, level);
            posToInsert -= 1; // Before /LI token
          }
          if (betweenNodes.size > 0) {
            tr = tr.replace(posToInsert, posToInsert, betweenNodes);
          }

          previousList.stitchingDepth = getListEndingMaxDepth(child);
          previousList.end = end;
          return;
        }
      }

      previousList = {
        stitchingDepth: getListEndingMaxDepth(child),
        start,
        end,
      };
    }
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
