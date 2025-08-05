import type { Node as ProseMirrorNode, ParseOptions } from 'prosemirror-model';
import type { Extension } from './Extension.ts';
import type { Mark } from './Mark.ts';
import type { Node } from './Node.ts';

export type AnyExtension = Extension | Node | Mark;
export type AnyExtensionOrReq = AnyExtension | {
  requires: Array<AnyExtensionOrReq | string>;
};

export type Content = JSONContent | JSONContent[] | null;

export interface EditorOptions {
  element: Element;
  content: Content;
  parseOptions: ParseOptions;
  extensions: AnyExtensionOrReq[];
  topNode?: string;
}

export type JSONContent = {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: {
    type: string;
    attrs?: Record<string, any>;
    [key: string]: any;
  }[];
  text?: string;
  [key: string]: any;
};

export type Attribute<T> = {
  fromDom?: (element: HTMLElement) => T;
  default: T;
  toDom?: (node: ProseMirrorNode) => T;
};
