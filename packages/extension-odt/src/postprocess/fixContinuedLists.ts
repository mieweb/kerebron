import { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

import { ListNumbering } from '../lists.ts';

const ANY_LIST = ['ordered_list', 'bullet_list'];

export const fixContinuedLists: Command = (state, dispatch): boolean => {
  const doc: Node = state.doc;
  let tr = state.tr;

  const listNumberings: Map<string, ListNumbering> = new Map<
    string,
    ListNumbering
  >();

  let topListId = '';

  function processContinuation(node: Node) {
    let listNumbering = null;

    if (topListId && listNumberings.has(topListId)) {
      listNumbering = listNumberings.get(topListId);
    }

    const cont = node.attrs['continue'];
    if (cont) {
      listNumbering = listNumberings.get(cont);
    }

    if (!listNumbering) {
      listNumbering = new ListNumbering(topListId);
    }

    listNumberings.set(topListId, listNumbering);

    return { listNumbering };
  }

  let possibleContinue = true;
  let level = 0;

  function walk(
    node: Node,
    pos = 0,
    depth = 0,
  ) {
    if ('list_item' === node.type.name) {
      const listNumbering = listNumberings.get('_current');
      const firstChild = node.content.firstChild;
      if (firstChild && listNumbering) {
        if (
          firstChild.type.name === 'paragraph' &&
          firstChild.content.childCount > 0
        ) {
          if (listNumbering.forceStart[level]) {
            delete listNumbering.forceStart[level];

            tr = tr.setNodeMarkup(tr.mapping.map(pos - 1), node.type, {
              ...node.attrs,
              value: listNumbering.levels[level],
            });
          }

          listNumbering.levels[level]++;
        } else {
          tr = tr.setNodeMarkup(tr.mapping.map(pos - 1), node.type, {
            ...node.attrs,
            type: 'none',
          });
          listNumbering.forceStart[level] = true;
        }
      }
    }

    if (!ANY_LIST.includes(node.type.name)) {
      node.forEach((child, offset) => {
        walk(child, pos + offset + 1, depth + 1);
      });
    } else {
      level++;

      if (level === 1) {
        topListId = node.attrs.id;
        possibleContinue = true;
      }

      const { listNumbering } = processContinuation(node);

      listNumberings.set('_current', listNumbering);

      if (!possibleContinue) {
        listNumbering.levels[level] = 1;
      }

      if (node.attrs.start) {
        listNumbering.levels[level] = node.attrs.start;
      }

      if ('ordered_list' === node.type.name) {
        if (1 < listNumbering.levels[level]) {
          tr = tr.setNodeMarkup(tr.mapping.map(pos - 1), node.type, {
            ...node.attrs,
            start: listNumbering.levels[level],
            continue: undefined,
          });
        }
      }

      node.forEach((child, offset) => {
        walk(child, pos + offset + 1, depth + 1);
      });

      if (level === 1) {
        listNumberings.set('_last', listNumbering);
      }

      level--;
      possibleContinue = false;
    }
  }

  walk(doc);

  if (dispatch) {
    dispatch(tr);
  }

  return tr.steps.length > 0;
};
