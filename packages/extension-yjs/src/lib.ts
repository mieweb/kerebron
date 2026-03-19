import * as Y from 'yjs';
import { type Node } from 'prosemirror-model';

export type TransactFunc<T> = (
  f: (arg0?: Y.Transaction) => T,
  origin?: any,
) => T;

/**
 * Either a node if type is YXmlElement or an Array of text nodes if YXmlText
 */
export type ProsemirrorMapping = Map<Y.AbstractType<any>, Node | Array<Node>>;
