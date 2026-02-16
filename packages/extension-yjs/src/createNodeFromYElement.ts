import * as PModel from 'prosemirror-model';
import { Mark, Schema } from 'prosemirror-model';
import * as Y from 'yjs';

import type { BindingMetadata } from './ProsemirrorBinding.ts';
import { ySyncPluginKey } from './keys.ts';
import { isVisible } from './utils.ts';
import { yattr2markname } from './updateYFragment.ts';

export const attributesToMarks = (
  attrs: { [s: string]: any },
  schema: Schema,
) => {
  const marks: Array<Mark> = [];
  for (const markName in attrs) {
    // remove hashes if necessary
    marks.push(schema.mark(yattr2markname(markName), attrs[markName]));
  }
  return marks;
};

export const createNodeIfNotExists = (
  el: Y.XmlElement,
  schema: PModel.Schema,
  meta: BindingMetadata,
  snapshot?: Y.Snapshot,
  prevSnapshot?: Y.Snapshot,
  computeYChange?: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): PModel.Node | null => {
  const node: PModel.Node = meta.mapping.get(el) as PModel.Node;
  if (node === undefined) {
    if (el instanceof Y.XmlElement) {
      return createNodeFromYElement(
        el,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
    } else {
      throw new Error('methodUnimplemented'); // we are currently not handling hooks
    }
  }
  return node;
};

export const createNodeFromYElement = (
  el: Y.XmlElement,
  schema: Schema,
  meta: BindingMetadata,
  snapshot?: Y.Snapshot,
  prevSnapshot?: Y.Snapshot,
  computeYChange?: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): PModel.Node | null => {
  const children: PModel.Node[] = [];
  const createChildren = (type: Y.XmlElement | Y.XmlText) => {
    if (type instanceof Y.XmlElement) {
      const n = createNodeIfNotExists(
        type,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
      if (n !== null) {
        children.push(n);
      }
    } else {
      // If the next ytext exists and was created by us, move the content to the current ytext.
      // This is a fix for #160 -- duplication of characters when two Y.Text exist next to each
      // other.
      const nextytext: Y.ContentType = type._item?.right?.content?.type;

      if (
        nextytext &&
        nextytext instanceof Y.Text && nextytext._item &&
        !nextytext._item.deleted &&
        nextytext._item.id.client === nextytext.doc!.clientID
      ) {
        type.applyDelta([
          { retain: type.length },
          ...nextytext.toDelta(),
        ]);
        nextytext.doc!.transact((tr) => {
          nextytext._item?.delete(tr);
        });
      }

      // now create the prosemirror text nodes
      const ns = createTextNodesFromYText(
        type,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
      if (ns !== null) {
        ns.forEach((textchild) => {
          if (textchild !== null) {
            children.push(textchild);
          }
        });
      }
    }
  };
  if (snapshot === undefined || prevSnapshot === undefined) {
    for (const item of el.toArray()) {
      if (item instanceof Y.XmlHook) {
        continue;
      }
      createChildren(item);
    }
  } else {
    Y.typeListToArraySnapshot(el, new Y.Snapshot(prevSnapshot.ds, snapshot.sv))
      .forEach(createChildren);
  }
  try {
    const attrs = el.getAttributes(snapshot);
    const item: Y.Item = el._item!;
    if (snapshot !== undefined) {
      const item: Y.Item = el._item!;
      if (!isVisible(item, snapshot)) {
        attrs.ychange = computeYChange
          ? computeYChange('removed', item.id)
          : { type: 'removed' };
      } else if (!isVisible(item, prevSnapshot)) {
        attrs.ychange = computeYChange
          ? computeYChange('added', item.id)
          : { type: 'added' };
      }
    }
    const node = schema.node(el.nodeName, attrs, children);
    meta.mapping.set(el, node);
    return node;
  } catch (e) {
    // an error occured while creating the node. This is probably a result of a concurrent action.
    el.doc?.transact((transaction) => {
      el._item?.delete(transaction);
    }, ySyncPluginKey);
    meta.mapping.delete(el);
    return null;
  }
};

/**
 * @private
 */
const createTextNodesFromYText = (
  text: Y.XmlText,
  schema: Schema,
  _meta: BindingMetadata,
  snapshot: Y.Snapshot,
  prevSnapshot: Y.Snapshot,
  computeYChange: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): Array<PModel.Node> | null => {
  const nodes: PModel.Node[] = [];
  const deltas = text.toDelta(snapshot, prevSnapshot, computeYChange);
  try {
    for (let i = 0; i < deltas.length; i++) {
      const delta = deltas[i];
      nodes.push(
        schema.text(delta.insert, attributesToMarks(delta.attributes, schema)),
      );
    }
  } catch (e) {
    text.doc?.transact((transaction) => {
      text._item?.delete(transaction);
    }, ySyncPluginKey);
    return null;
  }
  return nodes;
};
