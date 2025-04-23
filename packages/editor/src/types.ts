import type { ParseOptions } from 'prosemirror-model';
import type { Extension } from './Extension.ts';
import type { Mark } from './Mark.ts';
import type { Node } from './Node.ts';

export type AnyExtension = (Extension | Node | Mark) & {
  requires: Set<AnyExtension | string>;
};
export type Extensions = AnyExtension[];

export type Content = JSONContent | JSONContent[] | null;

export interface EditorOptions {
  element: Element;
  content: Content;
  parseOptions: ParseOptions;
  extensions: Extensions;
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
