import type { ResolvedPos } from 'prosemirror-model';
import type { TextRange } from '@kerebron/editor';
import { EditorView } from 'prosemirror-view';

export type SuggestionMatch = {
  range: TextRange;
  query: string;
  text: string;
} | null;

export type AutocompleteMatcher = (pos: ResolvedPos) => SuggestionMatch;

export interface SuggestionKeyDownProps {
  view: EditorView;
  event: KeyboardEvent;
  range: TextRange;
}

export interface AutocompleteRenderer<I = any, TSelected = any> {
  onBeforeStart?: (props: SuggestionProps<I, TSelected>) => void;
  onStart?: (props: SuggestionProps<I, TSelected>) => void;
  onBeforeUpdate?: (props: SuggestionProps<I, TSelected>) => void;
  onUpdate?: (props: SuggestionProps<I, TSelected>) => void;
  onExit?: (props: SuggestionProps<I, TSelected>) => void;
  onKeyDown?: (props: SuggestionKeyDownProps) => boolean;
}

export interface SuggestionProps<I = any, TSelected = any> {
  /**
   * The range of the suggestion.
   */
  range: TextRange;

  /**
   * The current suggestion query.
   */
  query: string;

  /**
   * The current suggestion text.
   */
  text: string;

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

  /**
   * The decoration node HTML element
   * @default null
   */
  decorationNode: Element | null;

  /**
   * The function that returns the client rect
   * @default null
   * @example () => new DOMRect(0, 0, 0, 0)
   */
  clientRect?: (() => DOMRect | null) | null;
}
