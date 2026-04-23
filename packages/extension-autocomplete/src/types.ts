import type { ResolvedPos } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import type { TextRange } from '@kerebron/editor';

export interface AutocompleteConfig {
  decorationTag?: string;
  decorationClass?: string;
}

export interface AutocompleteProps {
  range: TextRange;
  isActive?: boolean;
}

export type AutocompleteMatcher = (
  pos: ResolvedPos,
) => SuggestionMatch | undefined;

export interface AutocompleteSource<I = any, TSelected = any> {
  getItems: (query: string, props: AutocompleteProps) => I[] | Promise<I[]>;

  onSelect: (selected: TSelected, range: TextRange) => void;
  allow?: (
    props: AutocompleteProps,
  ) => boolean;

  matchers?: AutocompleteMatcher[];
  renderer?: AutocompleteRenderer<I, TSelected>;
  triggerKeys?: string[];
}

export interface SuggestionKeyDownProps {
  event: KeyboardEvent;
}

export type SuggestionMatch = {
  range: TextRange;
  query: string;
};

export interface SuggestionProps<I = any, TSelected = any> {
  match: SuggestionMatch;

  /**
   * The suggestion items array.
   */
  items: I[];

  /**
   * A function that is called when a suggestion is selected.
   * @param props The props object.
   * @returns void
   */
  command: (props: TSelected) => void;

  // /**
  //  * The decoration node HTML element
  //  * @default null
  //  */
  // decorationNode: Element | null;

  /**
   * The function that returns the client rect
   * @default null
   * @example () => new DOMRect(0, 0, 0, 0)
   */
  clientRect?: (() => DOMRect | null) | null;
}

export interface AutocompleteRenderer<I = any, TSelected = any> {
  // setDecorationNode(node: HTMLElement): void;
  onBeforeUpdate?: () => void;
  onUpdate: (props: SuggestionProps<I, TSelected>) => void;
  onKeyDown?: (props: SuggestionKeyDownProps) => boolean;
  destroy: () => void;
  refresh: () => void;

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

export type MatchedSource = undefined | {
  match: SuggestionMatch;
  source: AutocompleteSource;
};
