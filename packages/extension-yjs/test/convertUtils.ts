import { Fragment, Node, type Schema } from 'prosemirror-model';
import * as Y from 'yjs';
import { TransactFunc } from './ySyncPlugin.ts';
import { BindingMetadata } from './ProsemirrorBinding.ts';
import { createNodeFromYElement, updateYFragment } from './updateYFragment.ts';

// export const createEmptyMeta = (): BindingMetadata => ({
//   mapping: new Map(),
//   isOMark: new Map(),
// });

// /**
//  * Utility function for converting an Y.Fragment to a ProseMirror fragment.
//  */
// export const yXmlFragmentToProseMirrorFragment = (
//   yXmlFragment: Y.XmlFragment,
//   schema: Schema,
// ) => {
//   const fragmentContent = yXmlFragment.toArray().map((t) =>
//     createNodeFromYElement(
//       /** @type {Y.XmlElement} */ (t),
//       schema,
//       createEmptyMeta(),
//     )
//   ).filter((n) => n !== null);
//   return Fragment.fromArray(fragmentContent);
// };

// /**
//  * Utility function for converting an Y.Fragment to a ProseMirror node.
//  */
// export const yXmlFragmentToProseMirrorRootNode = (
//   yXmlFragment: Y.XmlFragment,
//   schema: Schema,
// ) =>
//   schema.topNodeType.create(
//     null,
//     yXmlFragmentToProseMirrorFragment(yXmlFragment, schema),
//   );

// /**
//  * The initial ProseMirror content should be supplied by Yjs. This function transforms a Y.Fragment
//  * to a ProseMirror Doc node and creates a mapping that is used by the sync plugin.
//  *
//  * @todo deprecate mapping property
//  */
// export const initProseMirrorDoc = (
//   yXmlFragment: Y.XmlFragment,
//   schema: Schema,
// ) => {
//   const meta = createEmptyMeta();
//   const fragmentContent = yXmlFragment.toArray().map((t) =>
//     createNodeFromYElement(
//       t,
//       schema,
//       meta,
//     )
//   ).filter((n) => n !== null);
//   return meta.mapping;
// };

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
  doc: Node,
  xmlFragment: Y.XmlFragment,
): Y.XmlFragment {
  const type = xmlFragment || new Y.XmlFragment();
  const ydoc: { transact: TransactFunc<void> } = type.doc
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
