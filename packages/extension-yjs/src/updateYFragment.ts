// deno-lint-ignore-file no-window
import * as Y from 'yjs';
import * as PModel from 'prosemirror-model';
import { Mark, Node, Schema } from 'prosemirror-model';

import { simpleDiff } from 'lib0/diff';

import { ySyncPluginKey } from './keys.ts';
import * as utils from './utils.ts';
import type { BindingMetadata } from './ProsemirrorBinding.ts';
import { isVisible, TransactFunc } from './ySyncPlugin.ts';

const hashedMarkNameRegex = /(.*)(--[a-zA-Z0-9+/=]{8})$/;
export const yattr2markname = (attrName: string) =>
  hashedMarkNameRegex.exec(attrName)?.[1] ?? attrName;

const marksToAttributes = (
  marks: readonly Mark[],
  meta: BindingMetadata,
): Record<string, PModel.Attrs> => {
  const pattrs: Record<string, PModel.Attrs> = {};
  marks.forEach((mark) => {
    if (mark.type.name !== 'ychange') {
      let isOverlapping = false;
      if (!meta.isOMark.has(mark.type)) {
        meta.isOMark.set(mark.type, !mark.type.excludes(mark.type));
        isOverlapping = true;
      }

      pattrs[
        isOverlapping
          ? `${mark.type.name}--${utils.hashOfJSON(mark.toJSON())}`
          : mark.type.name
      ] = mark.attrs;
    }
  });
  return pattrs;
};

/**
 * @todo move this to markstoattributes
 */
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

const equalYTextPText = (ytext: Y.XmlText, ptexts: Array<any>): boolean => {
  const delta = ytext.toDelta();
  return delta.length === ptexts.length &&
    delta.every((d: any, i: number): boolean =>
      d.insert === /** @type {any} */ (ptexts[i]).text &&
      Object.keys(d.attributes || {}).length === ptexts[i].marks.length &&
      Object.entries(d.attributes || {}).every(([yattrname, attr]) => {
        const markname = yattr2markname(yattrname);
        const pmarks = ptexts[i].marks;
        return equalAttrs(
          attr,
          pmarks.find((mark: Mark) => mark.type.name === markname)?.attrs,
        );
      })
    );
};

const ytextTrans = (ytext: Y.Text) => {
  let str = '';
  let n: Y.Item | null = ytext._start;
  const nAttrs: Record<string, null> = {};
  while (n !== null) {
    if (!n.deleted) {
      if (n.countable && n.content instanceof Y.ContentString) {
        str += n.content.str;
      } else if (n.content instanceof Y.ContentFormat) {
        nAttrs[n.content.key] = null;
      }
    }
    n = n.right;
  }
  return {
    str,
    nAttrs,
  };
};

type PMTextNodes = Array<PModel.Node>;

const normalizePNodeContent = (
  pnode: any,
): Array<PMTextNodes | PModel.Node> => {
  const c = pnode.content.content;
  const res = [];
  for (let i = 0; i < c.length; i++) {
    const n: PModel.Node = c[i];
    if (n.isText) {
      const textNodes: PMTextNodes = [];
      for (let tnode = c[i]; i < c.length && tnode.isText; tnode = c[++i]) {
        textNodes.push(tnode);
      }
      i--;
      res.push(textNodes);
    } else {
      res.push(n);
    }
  }
  return res;
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

/**
 * @private
 */
const createTypeFromTextNodes = (
  nodes: PMTextNodes,
  meta: BindingMetadata,
): Y.XmlText => {
  const type = new Y.XmlText();
  const delta = nodes.map((node) => ({
    insert: node.text,
    attributes: marksToAttributes(node.marks, meta),
  }));
  type.applyDelta(delta);
  meta.mapping.set(type, nodes);
  return type;
};

type NodeResult<T> = T extends PMTextNodes ? Y.XmlText : Y.XmlElement;

function createTypeFromTextOrElementNode<T extends PModel.Node | PMTextNodes>(
  node: T,
  meta: BindingMetadata,
): NodeResult<T> {
  return (Array.isArray(node)
    ? createTypeFromTextNodes(node, meta)
    : createTypeFromElementNode(node, meta)) as NodeResult<T>;
}

const isObject = (val: any) => typeof val === 'object' && val !== null;

const equalAttrs = (pattrs: any, yattrs: any) => {
  const keys = Object.keys(pattrs).filter((key) => pattrs[key] !== null);
  let eq = keys.length ===
    (yattrs == null
      ? 0
      : Object.keys(yattrs).filter((key) => yattrs[key] !== null).length);
  for (let i = 0; i < keys.length && eq; i++) {
    const key = keys[i];
    const l = pattrs[key];
    const r = yattrs[key];
    eq = key === 'ychange' || l === r ||
      (isObject(l) && isObject(r) && equalAttrs(l, r));
  }
  return eq;
};

/**
 * @private
 */
const createTypeFromElementNode = (
  node: PModel.Node,
  meta: BindingMetadata,
): Y.XmlElement => {
  const type = new Y.XmlElement(node.type.name);
  for (const key in node.attrs) {
    const val = node.attrs[key];
    if (val !== null && key !== 'ychange') {
      type.setAttribute(key, val);
    }
  }
  const pChildren: Array<PMTextNodes | PModel.Node> = normalizePNodeContent(
    node,
  );
  const yElems: Array<Y.XmlElement | Y.XmlText> = pChildren.map((n) =>
    createTypeFromTextOrElementNode(n, meta)
  );
  type.insert(0, yElems);
  meta.mapping.set(type, node);
  return type;
};

const mappedIdentity = (
  mapped: PModel.Node | Array<PModel.Node> | undefined,
  pcontent: PModel.Node | Array<PModel.Node>,
) =>
  mapped === pcontent ||
  (mapped instanceof Array && pcontent instanceof Array &&
    mapped.length === pcontent.length &&
    mapped.every((a, i) => pcontent[i] === a));

const computeChildEqualityFactor = (
  ytype: Y.XmlElement,
  pnode: PModel.Node,
  meta: BindingMetadata,
): { foundMappedChild: boolean; equalityFactor: number } => {
  const yChildren = ytype.toArray();
  const pChildren: Array<PMTextNodes | PModel.Node> = normalizePNodeContent(
    pnode,
  );
  const pChildCnt = pChildren.length;
  const yChildCnt = yChildren.length;
  const minCnt = Math.min(yChildCnt, pChildCnt);
  let left = 0;
  let right = 0;
  let foundMappedChild = false;
  for (; left < minCnt; left++) {
    const leftY = yChildren[left];
    const leftP = pChildren[left];
    if (mappedIdentity(meta.mapping.get(leftY), leftP)) {
      foundMappedChild = true; // definite (good) match!
    } else if (!equalYTypePNode(leftY, leftP)) {
      break;
    }
  }
  for (; left + right < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1];
    const rightP = pChildren[pChildCnt - right - 1];
    if (mappedIdentity(meta.mapping.get(rightY), rightP)) {
      foundMappedChild = true;
    } else if (!equalYTypePNode(rightY, rightP)) {
      break;
    }
  }
  return {
    equalityFactor: left + right,
    foundMappedChild,
  };
};

const matchNodeName = (
  yElement: Y.XmlElement,
  pNode: PModel.Node | PMTextNodes,
) => !(pNode instanceof Array) && yElement.nodeName === pNode.type.name;

const equalYTypePNode = (
  ytype: Y.XmlElement | Y.XmlText | Y.XmlHook,
  pnode: any | Array<any>,
): boolean => {
  if (
    ytype instanceof Y.XmlElement && !(pnode instanceof Array) &&
    matchNodeName(ytype, pnode)
  ) {
    const normalizedContent: Array<PMTextNodes | PModel.Node> =
      normalizePNodeContent(pnode);
    return ytype._length === normalizedContent.length &&
      equalAttrs(ytype.getAttributes(), pnode.attrs) &&
      ytype.toArray().every((ychild, i) =>
        equalYTypePNode(ychild, normalizedContent[i])
      );
  }
  return ytype instanceof Y.XmlText && pnode instanceof Array &&
    equalYTextPText(ytype, pnode);
};

/**
 * @todo test this more
 */
const updateYText = (
  ytext: Y.Text,
  ptexts: PMTextNodes,
  meta: BindingMetadata,
) => {
  meta.mapping.set(ytext, ptexts);
  const { nAttrs, str } = ytextTrans(ytext);
  const content = ptexts.map((p) => ({
    insert: p.text || '',
    attributes: Object.assign({}, nAttrs, marksToAttributes(p.marks, meta)),
  }));
  const { insert, remove, index } = simpleDiff(
    str,
    content.map((c) => c.insert).join(''),
  );
  ytext.delete(index, remove);
  ytext.insert(index, insert);
  ytext.applyDelta(
    content.map((c) => ({ retain: c.insert.length, attributes: c.attributes })),
  );
};

/**
 * Update a yDom node by syncing the current content of the prosemirror node.
 *
 * This is a y-prosemirror internal feature that you can use at your own risk.
 *
 * @private
 * @unstable
 */
export const updateYFragment = (
  ydoc: { transact: TransactFunc<void> },
  yDomFragment: Y.XmlFragment,
  pNode: Node,
  meta: BindingMetadata,
) => {
  if (
    yDomFragment instanceof Y.XmlElement &&
    yDomFragment.nodeName !== pNode.type.name
  ) {
    throw new Error('node name mismatch!');
  }
  meta.mapping.set(yDomFragment, pNode);
  // update attributes
  if (yDomFragment instanceof Y.XmlElement) {
    const yDomAttrs = yDomFragment.getAttributes();
    const pAttrs = pNode.attrs;
    for (const key in pAttrs) {
      if (pAttrs[key] !== null) {
        if (yDomAttrs[key] !== pAttrs[key] && key !== 'ychange') {
          yDomFragment.setAttribute(key, pAttrs[key]);
        }
      } else {
        yDomFragment.removeAttribute(key);
      }
    }
    // remove all keys that are no longer in pAttrs
    for (const key in yDomAttrs) {
      if (pAttrs[key] === undefined) {
        yDomFragment.removeAttribute(key);
      }
    }
  }
  // update children
  const pChildren: Array<PMTextNodes | PModel.Node> = normalizePNodeContent(
    pNode,
  );
  const pChildCnt = pChildren.length;
  const yChildren = yDomFragment.toArray() as Array<Y.XmlElement | Y.XmlText>;
  const yChildCnt = yChildren.length;
  const minCnt = Math.min(pChildCnt, yChildCnt);
  let left = 0;
  let right = 0;
  // find number of matching elements from left
  for (; left < minCnt; left++) {
    const leftY = yChildren[left];
    const leftP = pChildren[left];
    if (!mappedIdentity(meta.mapping.get(leftY), leftP)) {
      if (equalYTypePNode(leftY, leftP)) {
        // update mapping
        meta.mapping.set(leftY, leftP);
      } else {
        break;
      }
    }
  }
  // find number of matching elements from right
  for (; right + left < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1];
    const rightP = pChildren[pChildCnt - right - 1];
    if (!mappedIdentity(meta.mapping.get(rightY), rightP)) {
      if (equalYTypePNode(rightY, rightP)) {
        // update mapping
        meta.mapping.set(rightY, rightP);
      } else {
        break;
      }
    }
  }
  ydoc.transact(() => {
    // try to compare and update
    while (yChildCnt - left - right > 0 && pChildCnt - left - right > 0) {
      const leftY: Y.XmlElement | Y.XmlText = yChildren[left];
      const leftP: PModel.Node | PMTextNodes = pChildren[left];
      const rightY: Y.XmlElement | Y.XmlText = yChildren[yChildCnt - right - 1];
      const rightP: PModel.Node | PMTextNodes =
        pChildren[pChildCnt - right - 1];
      if (leftY instanceof Y.XmlText && leftP instanceof Array) {
        if (!equalYTextPText(leftY, leftP)) {
          updateYText(leftY, leftP, meta);
        }
        left += 1;
      } else {
        let updateLeft = leftY instanceof Y.XmlElement &&
          matchNodeName(leftY, leftP);
        let updateRight = rightY instanceof Y.XmlElement &&
          matchNodeName(rightY, rightP);
        if (updateLeft && updateRight) {
          // decide which element to update
          const equalityLeft = computeChildEqualityFactor(
            leftY as Y.XmlElement,
            leftP as PModel.Node,
            meta,
          );
          const equalityRight = computeChildEqualityFactor(
            rightY as Y.XmlElement,
            rightP as PModel.Node,
            meta,
          );
          if (
            equalityLeft.foundMappedChild && !equalityRight.foundMappedChild
          ) {
            updateRight = false;
          } else if (
            !equalityLeft.foundMappedChild && equalityRight.foundMappedChild
          ) {
            updateLeft = false;
          } else if (
            equalityLeft.equalityFactor < equalityRight.equalityFactor
          ) {
            updateLeft = false;
          } else {
            updateRight = false;
          }
        }
        if (updateLeft) {
          updateYFragment(
            ydoc,
            leftY as Y.XmlElement,
            leftP as PModel.Node,
            meta,
          );
          left += 1;
        } else if (updateRight) {
          updateYFragment(
            ydoc,
            rightY as Y.XmlElement,
            rightP as PModel.Node,
            meta,
          );
          right += 1;
        } else {
          meta.mapping.delete(yDomFragment.get(left));
          yDomFragment.delete(left, 1);
          yDomFragment.insert(left, [
            createTypeFromTextOrElementNode(leftP, meta),
          ]);
          left += 1;
        }
      }
    }
    const yDelLen = yChildCnt - left - right;
    if (
      yChildCnt === 1 && pChildCnt === 0 && yChildren[0] instanceof Y.XmlText
    ) {
      meta.mapping.delete(yChildren[0]);
      // Edge case handling https://github.com/yjs/y-prosemirror/issues/108
      // Only delete the content of the Y.Text to retain remote changes on the same Y.Text object
      yChildren[0].delete(0, yChildren[0].length);
    } else if (yDelLen > 0) {
      yDomFragment.slice(left, left + yDelLen).forEach((type) =>
        meta.mapping.delete(type)
      );
      yDomFragment.delete(left, yDelLen);
    }
    if (left + right < pChildCnt) {
      const ins = [];
      for (let i = left; i < pChildCnt - right; i++) {
        ins.push(createTypeFromTextOrElementNode(pChildren[i], meta));
      }
      yDomFragment.insert(left, ins);
    }
  }, ySyncPluginKey);
};
