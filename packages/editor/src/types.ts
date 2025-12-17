import type { Node as ProseMirrorNode, ParseOptions } from 'prosemirror-model';
import type { Extension } from './Extension.ts';
import type { Mark } from './Mark.ts';
import type { Node } from './Node.ts';

export type AnyExtension = Extension | Node | Mark;
export type AnyExtensionOrReq = AnyExtension | {
  requires: Array<AnyExtensionOrReq | string>;
};

export type Content = JSONContent | JSONContent[] | null;

export interface EditorConfig {
  element: HTMLElement;
  content: Content;
  parseOptions: ParseOptions;
  extensions: AnyExtensionOrReq[];
  cdnUrl?: string;
  uri?: string;
  languageID?: string;
  topNode?: string;
  readOnly?: boolean;
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

export interface TextRange {
  from: number;
  to: number;
}

export interface RawTextMapEntry {
  nodeIdx: number;
  targetRow: number;
  targetCol: number;
  sourceCol?: number;
  targetPos: number;
}

export interface RawTextResult {
  content: string;
  rawTextMap: Array<RawTextMapEntry>;
}

export interface UrlRewriteContext {
  type: 'IMG' | 'A';
  dest: string; // Dest format, eg: kerebron, md, odt
  filesMap?: Record<string, Uint8Array>;
}

export type UrlRewriter = (url: string, ctx: UrlRewriteContext) => string;
