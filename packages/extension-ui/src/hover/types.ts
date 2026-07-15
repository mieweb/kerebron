import { Node as PmNode } from 'prosemirror-model';
import { TextRange } from '@kerebron/editor';

export interface HoverConfig {
  decorationTag?: string;
  decorationClass?: string;
}

export interface HoverTrigger {
  pos: number;
  inside: number;
  node?: PmNode;
  uri?: string;
}

export interface HoverMatch {
  source: HoverSource;
  range: TextRange;
  text?: string;
  uri?: string;
  trigger: HoverTrigger;
}

export interface HoverSource<I = any> {
  match: (trigger: HoverTrigger) => HoverMatch | undefined;
  getItem: (range: TextRange, trigger: HoverTrigger) => I | Promise<I>;
}
