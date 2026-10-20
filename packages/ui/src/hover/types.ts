import { Node as PmNode } from 'prosemirror-model';
import { TextRange } from '@kerebron/editor';
import { KerebronPopup } from '../popup/types.ts';

export interface HoverConfig {
  decorationClass?: string;
}

export interface HoverTrigger {
  mode: 'mouse' | 'keyboard';
  pos: number;
  textOffset: number;
  node?: PmNode;
  uri?: string;
}

export interface HoverMatch<I = any> {
  range: TextRange;
  text: string;
  meta?: I;
}

type HoverResponse = HoverMatch;

export type HoverMatcher = (
  this: HoverSource,
  trigger: HoverTrigger,
) => HoverMatch | undefined;

export interface HoverSource {
  match: HoverMatcher;
  processRequest: (
    trigger: HoverTrigger,
    match: HoverMatch,
    createPopup: () => KerebronPopup,
  ) => Promise<HoverResponse | undefined>;
}
