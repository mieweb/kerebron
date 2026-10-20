import type { Node as PmNode } from 'prosemirror-model';

import type { TextRange } from '@kerebron/editor';

import { KerebronPopup } from '../popup/types.ts';

export interface AutocompleteConfig {
  decorationClass?: string;
}

export type AutocompleteTrigger =
  | AutocompleteTriggerAuto
  | AutocompleteTriggerKeyboard;

interface AutocompleteTriggerAuto {
  mode: 'auto';
  pos: number;
  textOffset: number;
  node?: PmNode;
  uri?: string;
}

interface AutocompleteTriggerKeyboard {
  mode: 'keyboard';
  pos: number;
  textOffset: number;
  node?: PmNode;
  uri?: string;
  key: string;
}

export interface AutocompletMatch<I = any> {
  range: TextRange;
  text: string;
  meta?: I;
}

type AutocompleteResponse = AutocompletMatch;

export type AutocompleteMatcher = (
  this: AutocompleteSource,
  trigger: AutocompleteTrigger,
) => AutocompletMatch | undefined;

export interface AutocompleteSource {
  match: AutocompleteMatcher;
  triggerKeys?: string[];
  processRequest: (
    trigger: AutocompleteTrigger,
    match: AutocompletMatch,
    createPopup: () => KerebronPopup,
  ) => Promise<AutocompleteResponse | undefined>;
}
