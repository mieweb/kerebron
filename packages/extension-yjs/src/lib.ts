import * as Y from 'yjs';
import { EditorView } from 'prosemirror-view';
import { Fragment, Node, Schema } from 'prosemirror-model';
import * as error from 'lib0/error';
import * as map from 'lib0/map';
import * as eventloop from 'lib0/eventloop';

import {
  createEmptyMeta,
  createNodeFromYElement,
  updateYFragment,
  yattr2markname,
} from './ySyncPlugin.ts';
import { ySyncPluginKey } from './keys.ts';

/**
 * Either a node if type is YXmlElement or an Array of text nodes if YXmlText
 */
type ProsemirrorMapping = Map<Y.AbstractType, Node | Array<Node>>;

/**
 * Is null if no timeout is in progress.
 * Is defined if a timeout is in progress.
 * Maps from view
 */
let viewsToUpdate: Map<EditorView, Map<any, any>> | null = null;

const updateMetas = () => {
  const ups: Map<EditorView, Map<any, any>> = viewsToUpdate;
  viewsToUpdate = null;
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

export const setMeta = (view, key, value) => {
  if (!viewsToUpdate) {
    viewsToUpdate = new Map();
    eventloop.timeout(0, updateMetas);
  }
  map.setIfUndefined(viewsToUpdate, view, map.create).set(key, value);
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
  /**
   * @type {any}
   */
  let n = type._first === null
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
            n = /** @type {Y.Item} */ (n._item).parent;
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
      throw error.unexpectedCase();
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

const createRelativePosition = (type, item) => {
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
  y: Y.Doc,
  documentType: Y.XmlFragment,
  relPos: any,
  mapping: ProsemirrorMapping,
): null | number => {
  const decodedPos = Y.createAbsolutePositionFromRelativePosition(relPos, y);
  if (
    decodedPos === null ||
    (decodedPos.type !== documentType &&
      !Y.isParentOf(documentType, decodedPos.type._item))
  ) {
    return null;
  }
  let type = decodedPos.type;
  let pos = 0;
  if (type.constructor === Y.XmlText) {
    pos = decodedPos.index;
  } else if (type._item === null || !type._item.deleted) {
    let n: Y.Item = type._first;
    let i = 0;
    while (i < type._length && i < decodedPos.index && n !== null) {
      if (!n.deleted) {
        const t: Y.ContentType = n.content.type;
        i++;
        if (t instanceof Y.XmlText) {
          pos += t._length;
        } else {
          pos += /** @type {any} */ (mapping.get(t)).nodeSize;
        }
      }
      n = n.right;
    }
    pos += 1; // increase because we go out of n
  }
  while (type !== documentType && type._item !== null) {
    // @ts-ignore
    const parent = type._item.parent;
    // @ts-ignore
    if (parent._item === null || !parent._item.deleted) {
      pos += 1; // the start tag
      let n = /** @type {Y.AbstractType} */ (parent)._first;
      // now iterate until we found type
      while (n !== null) {
        const contentType = /** @type {Y.ContentType} */ (n.content).type;
        if (contentType === type) {
          break;
        }
        if (!n.deleted) {
          if (contentType instanceof Y.XmlText) {
            pos += contentType._length;
          } else {
            pos += /** @type {any} */ (mapping.get(contentType)).nodeSize;
          }
        }
        n = n.right;
      }
    }
    type = /** @type {Y.AbstractType} */ (parent);
  }
  return pos - 1; // we don't count the most outer tag, because it is a fragment
};

/**
 * Utility function for converting an Y.Fragment to a ProseMirror fragment.
 */
export const yXmlFragmentToProseMirrorFragment = (
  yXmlFragment: Y.XmlFragment,
  schema: Schema,
) => {
  const fragmentContent = yXmlFragment.toArray().map((t) =>
    createNodeFromYElement(
      /** @type {Y.XmlElement} */ (t),
      schema,
      createEmptyMeta(),
    )
  ).filter((n) => n !== null);
  return Fragment.fromArray(fragmentContent);
};

/**
 * Utility function for converting an Y.Fragment to a ProseMirror node.
 */
export const yXmlFragmentToProseMirrorRootNode = (
  yXmlFragment: Y.XmlFragment,
  schema: Schema,
) =>
  schema.topNodeType.create(
    null,
    yXmlFragmentToProseMirrorFragment(yXmlFragment, schema),
  );

/**
 * The initial ProseMirror content should be supplied by Yjs. This function transforms a Y.Fragment
 * to a ProseMirror Doc node and creates a mapping that is used by the sync plugin.
 *
 * @todo deprecate mapping property
 */
export const initProseMirrorDoc = (
  yXmlFragment: Y.XmlFragment,
  schema: Schema,
) => {
  const meta = createEmptyMeta();
  const fragmentContent = yXmlFragment.toArray().map((t) =>
    createNodeFromYElement(
      /** @type {Y.XmlElement} */ (t),
      schema,
      meta,
    )
  ).filter((n) => n !== null);
  const doc = schema.topNodeType.create(
    null,
    Fragment.fromArray(fragmentContent),
  );
  return { doc, meta, mapping: meta.mapping };
};

/**
 * Utility method to convert a Prosemirror Doc Node into a Y.Doc.
 *
 * This can be used when importing existing content to Y.Doc for the first time,
 * note that this should not be used to rehydrate a Y.Doc from a database once
 * collaboration has begun as all history will be lost
 */
export function prosemirrorToYDoc(
  doc: Node,
  xmlFragment: string = 'prosemirror',
): Y.Doc {
  const ydoc = new Y.Doc();
  const type =
    /** @type {Y.XmlFragment} */ (ydoc.get(xmlFragment, Y.XmlFragment));
  if (!type.doc) {
    return ydoc;
  }

  prosemirrorToYXmlFragment(doc, type);
  return type.doc;
}

/**
 * Utility method to update an empty Y.XmlFragment with content from a Prosemirror Doc Node.
 *
 * This can be used when importing existing content to Y.Doc for the first time,
 * note that this should not be used to rehydrate a Y.Doc from a database once
 * collaboration has begun as all history will be lost
 *
 * Note: The Y.XmlFragment does not need to be part of a Y.Doc document at the time that this
 * method is called, but it must be added before any other operations are performed on it.
 */
export function prosemirrorToYXmlFragment(
  doc: Y.Doc,
  xmlFragment: Y.XmlFragment,
): Y.XmlFragment {
  const type = xmlFragment || new Y.XmlFragment();
  const ydoc = type.doc
    ? type.doc
    : { transact: (transaction) => transaction(undefined) };
  updateYFragment(ydoc, type, doc, { mapping: new Map(), isOMark: new Map() });
  return type;
}

/**
 * Utility method to convert Prosemirror compatible JSON into a Y.Doc.
 *
 * This can be used when importing existing content to Y.Doc for the first time,
 * note that this should not be used to rehydrate a Y.Doc from a database once
 * collaboration has begun as all history will be lost
 */
export function prosemirrorJSONToYDoc(
  schema: Schema,
  state: any,
  xmlFragment: string = 'prosemirror',
): Y.Doc {
  const doc = Node.fromJSON(schema, state);
  return prosemirrorToYDoc(doc, xmlFragment);
}

/**
 * Utility method to convert Prosemirror compatible JSON to a Y.XmlFragment
 *
 * This can be used when importing existing content to Y.Doc for the first time,
 * note that this should not be used to rehydrate a Y.Doc from a database once
 * collaboration has begun as all history will be lost
 */
export function prosemirrorJSONToYXmlFragment(
  schema: Schema,
  state: any,
  xmlFragment: Y.XmlFragment,
): Y.XmlFragment {
  const doc = Node.fromJSON(schema, state);
  return prosemirrorToYXmlFragment(doc, xmlFragment);
}
