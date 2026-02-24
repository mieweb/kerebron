import { Fragment, Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

const ANY_LIST = ['ordered_list', 'bullet_list'];

type LevelMargins = Array<number>;

// Related tests:
// test ./example-document.md
export const fixListsLevels: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  const schema = state.schema;
  const bulletListType = schema.nodes.bullet_list;
  const listItemType = schema.nodes.list_item;
  const paragraphType = schema.nodes.paragraph;

  const tr = state.tr;

  let level = 0;

  let prevList: LevelMargins = [];
  let curList: LevelMargins = [];
  let fakeLevelGenerated = 0;

  function walk(
    node: Node,
    pos = 0,
    depth = 0,
  ) {
    if (!ANY_LIST.includes(node.type.name)) {
      node.forEach((child, offset) => {
        walk(child, pos + offset + 1, depth + 1);
      });
    } else {
      const marginLeft = node.attrs['odtMarginLeft'] || 0;
      if (level === 0) {
        curList = [];
        fakeLevelGenerated = 0;
        if (prevList.length >= level) {
          for (let i = 0; i < prevList.length; i++) {
            if (
              fakeLevelGenerated < prevList.length &&
              marginLeft > prevList[fakeLevelGenerated]
            ) {
              curList[level + fakeLevelGenerated] =
                prevList[fakeLevelGenerated];
              fakeLevelGenerated++;
            }
          }
        }
      }

      curList[level + fakeLevelGenerated] = marginLeft;

      level++;

      node.forEach((child, offset) => {
        walk(child, pos + offset + 1, depth + 1);
      });

      level--;

      if (level === 0 && !node.attrs.toc) {
        prevList = curList;
        for (let i = 0; i < fakeLevelGenerated; i++) {
          const wrapper = bulletListType.create(
            { type: 'none' },
            listItemType.create(
              null,
              Fragment.from([
                paragraphType.create(),
                node,
              ]),
            ),
          );
          tr.replaceWith(
            tr.mapping.map(pos),
            tr.mapping.map(pos + node.nodeSize),
            wrapper,
          );
        }
      }
    }
  }

  walk(doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
