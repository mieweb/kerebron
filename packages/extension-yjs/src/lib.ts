import * as Y from 'yjs';
import { type EditorView } from 'prosemirror-view';
import { type Node } from 'prosemirror-model';

import { ySyncPluginKey } from './keys.ts';

/**
 * Either a node if type is YXmlElement or an Array of text nodes if YXmlText
 */
type ProsemirrorMapping = Map<Y.AbstractType<any>, Node>;

/**
 * Is null if no timeout is in progress.
 * Is defined if a timeout is in progress.
 * Maps from view
 */
let viewsToUpdate: Map<EditorView, Map<any, any>> | null = null;

const updateMetas = () => {
  const ups: Map<EditorView, Map<any, any>> | null = viewsToUpdate;
  viewsToUpdate = null;
  if (!ups) {
    return;
  }
  ups.forEach((metas, view) => {
    const tr = view.state.tr;
    const syncState = ySyncPluginKey.getState(view.state);
    if (syncState && syncState.binding && !syncState.binding.isDestroyed) {
      metas.forEach((val, key) => {
        tr.setMeta(key, val);
      });
      view.dispatch(tr);
    }
  });
};

export const setMeta = (view: EditorView, key, value) => {
  if (!viewsToUpdate) {
    viewsToUpdate = new Map();
    setTimeout(updateMetas, 0);
  }

  let subMap = viewsToUpdate.get(view);
  if (subMap === undefined) {
    subMap = new Map();
    viewsToUpdate.set(view, subMap);
  }
  subMap.set(key, value);
};

/**
 * Transforms a Prosemirror based absolute position to a Yjs Cursor (relative position in the Yjs model).
 */
export const absolutePositionToRelativePosition = (
  pos: number,
  type: Y.XmlFragment,
  mapping: ProsemirrorMapping,
): any => {
  if (pos === 0) {
    // if the type is later populated, we want to retain the 0 position (hence assoc=-1)
    return Y.createRelativePositionFromTypeIndex(
      type,
      0,
      type.length === 0 ? -1 : 0,
    );
  }

  let n: Y.AbstractType<any> | null = type._first === null
    ? null
    : /** @type {Y.ContentType} */ (type._first.content).type;
  while (n !== null && type !== n) {
    if (n instanceof Y.XmlText) {
      if (n._length >= pos) {
        return Y.createRelativePositionFromTypeIndex(
          n,
          pos,
          type.length === 0 ? -1 : 0,
        );
      } else {
        pos -= n._length;
      }
      if (n._item !== null && n._item.next !== null) {
        n = /** @type {Y.ContentType} */ (n._item.next.content).type;
      } else {
        do {
          n = n._item === null ? null : n._item.parent;
          pos--;
        } while (
          n !== type && n !== null && n._item !== null && n._item.next === null
        );
        if (n !== null && n !== type) {
          // @ts-gnore we know that n.next !== null because of above loop conditition
          n = n._item === null
            ? null
            : /** @type {Y.ContentType} */ (/** @type Y.Item */ (n._item.next)
              .content).type;
        }
      }
    } else {
      const pNodeSize =
        /** @type {any} */ (mapping.get(n) || { nodeSize: 0 }).nodeSize;
      if (n._first !== null && pos < pNodeSize) {
        n = /** @type {Y.ContentType} */ (n._first.content).type;
        pos--;
      } else {
        if (pos === 1 && n._length === 0 && pNodeSize > 1) {
          // edge case, should end in this paragraph
          return new Y.RelativePosition(
            n._item === null ? null : n._item.id,
            n._item === null ? Y.findRootTypeKey(n) : null,
            null,
          );
        }
        pos -= pNodeSize;
        if (n._item !== null && n._item.next !== null) {
          n = /** @type {Y.ContentType} */ (n._item.next.content).type;
        } else {
          if (pos === 0) {
            // set to end of n.parent
            n = n._item === null ? n : n._item.parent;
            return new Y.RelativePosition(
              n._item === null ? null : n._item.id,
              n._item === null ? Y.findRootTypeKey(n) : null,
              null,
            );
          }
          do {
            n = n._item.parent;
            pos--;
          } while (n !== type && /** @type {Y.Item} */ (n._item).next === null);
          // if n is null at this point, we have an unexpected case
          if (n !== type) {
            // We know that n._item.next is defined because of above loop condition
            n =
              /** @type {Y.ContentType} */ (/** @type {Y.Item} */ (/** @type {Y.Item} */ (n
                ._item).next).content).type;
          }
        }
      }
    }
    if (n === null) {
      throw new Error('Unexpected case');
    }
    if (pos === 0 && n.constructor !== Y.XmlText && n !== type) { // TODO: set to <= 0
      return createRelativePosition(n._item.parent, n._item);
    }
  }
  return Y.createRelativePositionFromTypeIndex(
    type,
    type._length,
    type.length === 0 ? -1 : 0,
  );
};

const createRelativePosition = (type: Y.AbstractType<any>, item: Y.Item) => {
  let typeid = null;
  let tname = null;
  if (type._item === null) {
    tname = Y.findRootTypeKey(type);
  } else {
    typeid = Y.createID(type._item.id.client, type._item.id.clock);
  }
  return new Y.RelativePosition(typeid, tname, item.id);
};

export const relativePositionToAbsolutePosition = (
  yDoc: Y.Doc,
  documentType: Y.XmlFragment,
  relPos: any,
  mapping: ProsemirrorMapping,
): null | number => {
  const decodedPos = Y.createAbsolutePositionFromRelativePosition(relPos, yDoc);
  if (
    decodedPos === null ||
    (decodedPos.type !== documentType &&
      !Y.isParentOf(documentType, decodedPos.type._item))
  ) {
    return null;
  }
  let type = decodedPos.type;
  let pos = 0;
  if (type instanceof Y.XmlText) {
    pos = decodedPos.index;
  } else if (type._item === null || !type._item.deleted) {
    let n: Y.Item | null = type._first;
    let i = 0;
    while (i < type._length && i < decodedPos.index && n !== null) {
      if (!n.deleted) {
        const t: Y.AbstractType<any> = n.content.type;
        i++;
        if (t instanceof Y.XmlText) {
          pos += t._length;
        } else {
          const node = mapping.get(t);
          pos += node?.nodeSize || 0;
        }
      }
      n = n.right;
    }
    pos += 1; // increase because we go out of n
  }
  while (type !== documentType && type._item !== null) {
    // @ts-ignore
    const parent = type._item.parent;
    if (parent instanceof Y.ID || parent === null) {
      continue;
    }
    // @ts-ignore
    if (parent._item === null || !parent._item.deleted) {
      pos += 1; // the start tag
      let n = /** @type {Y.AbstractType} */ (parent)._first;
      // now iterate until we found type
      while (n !== null) {
        const contentType: Y.AbstractType<any> = n.content.type;
        if (contentType === type) {
          break;
        }
        if (!n.deleted) {
          if (contentType instanceof Y.XmlText) {
            pos += contentType._length;
          } else {
            const node = mapping.get(contentType);
            pos += node?.nodeSize || 0;
          }
        }
        n = n.right;
      }
    }
    type = parent;
  }
  return pos - 1; // we don't count the most outer tag, because it is a fragment
};
