import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { type CoreEditor, type TextRange } from '@kerebron/editor';

import type { AutocompleteConfig } from './ExtensionAutocomplete.ts';
import {
  AutocompleteMatcher,
  AutocompleteRenderer,
  SuggestionProps,
} from './types.ts';
import { createDefaultMatcher } from './createDefaultMatcher.ts';
import { DefaultRenderer } from './DefaultRenderer.ts';

export const AutocompletePluginKey = new PluginKey('autocomplete');

export class AutocompletePlugin<Item, TSelected> extends Plugin {
  constructor(config: AutocompleteConfig, editor: CoreEditor) {
    let props: SuggestionProps<Item, TSelected> | undefined;
    const renderer: AutocompleteRenderer = config.renderer ||
      new DefaultRenderer(editor);

    super({
      key: AutocompletePluginKey,
      view() {
        return {
          update: async (view, prevState) => {
            const prev = this.key?.getState(prevState);
            const next = this.key?.getState(view.state);

            const moved = prev.active && next.active &&
              prev.range.from !== next.range.from;
            const started = !prev.active && next.active;
            const stopped = prev.active && !next.active;
            const changed = !started && !stopped && prev.query !== next.query;

            const handleStart = started || (moved && changed);
            const handleChange = changed || moved;
            const handleExit = stopped || (moved && changed);

            if (!handleStart && !handleChange && !handleExit) {
              return;
            }

            const state = handleExit && !handleStart ? prev : next;
            const decorationNode = view.dom.querySelector(
              `[data-decoration-id="${state.decorationId}"]`,
            );

            props = {
              range: state.range,
              query: state.query,
              text: state.text,
              items: [],
              command: (selected) => {
                if (!config.onSelect) {
                  return () => {};
                }
                return config.onSelect(selected, state.range);
              },
              decorationNode,
              // virtual node for popper.js or tippy.js
              // this can be used for building popups without a DOM node
              clientRect: decorationNode
                ? () => {
                  // because of `items` can be asynchrounous we’ll search for the current decoration node
                  const { decorationId } = this.key?.getState(editor.state); // eslint-disable-line
                  const currentDecorationNode = view.dom.querySelector(
                    `[data-decoration-id="${decorationId}"]`,
                  );

                  return currentDecorationNode?.getBoundingClientRect() || null;
                }
                : null,
            };

            if (handleStart) {
              renderer?.onBeforeStart?.(props);
            }

            if (handleChange) {
              renderer?.onBeforeUpdate?.(props);
            }

            if (handleChange || handleStart) {
              if (config.getItems) {
                props.items = await config.getItems(state.query);
              }
            }

            if (handleExit) {
              renderer?.onExit?.(props);
            }

            if (handleChange) {
              renderer?.onUpdate?.(props);
            }

            if (handleStart) {
              renderer?.onStart?.(props);
            }
          },

          destroy: () => {
            if (!props) {
              return;
            }

            renderer?.onExit?.(props);
          },
        };
      },

      state: {
        // Initialize the plugin's internal state.
        init() {
          const state: {
            active: boolean;
            range: TextRange;
            query: null | string;
            text: null | string;
            composing: boolean;
            decorationId?: string | null;
          } = {
            active: false,
            range: {
              from: 0,
              to: 0,
            },
            query: null,
            text: null,
            composing: false,
          };

          return state;
        },

        // Apply changes to the plugin state from a view transaction.
        apply(transaction, prev, _oldState, state) {
          // const { isEditable } = editor; // TODO
          const isEditable = true;
          const { composing } = editor.view;
          const { selection } = transaction;
          const { empty, from } = selection;
          const next = { ...prev };

          next.composing = composing;

          if (isEditable && (empty || editor.view.composing)) {
            // Reset active state if we just left the previous suggestion range
            if (
              (from < prev.range.from || from > prev.range.to) && !composing &&
              !prev.composing
            ) {
              next.active = false;
            }

            const matchers: AutocompleteMatcher[] = config.matchers ||
              [createDefaultMatcher()];
            let match = undefined;
            for (const matcher of matchers) {
              match = matcher(selection.$from);
              if (match) {
                break;
              }
            }

            const decorationId = `id_${Math.floor(Math.random() * 0xffffffff)}`;

            // If we found a match, update the current state to show it
            if (
              match && (!config.allow || config.allow({
                state,
                range: match.range,
                isActive: prev.active,
              }))
            ) {
              next.active = true;
              next.decorationId = prev.decorationId
                ? prev.decorationId
                : decorationId;
              next.range = match.range;
              next.query = match.query;
              next.text = match.text;
            } else {
              next.active = false;
            }
          } else {
            next.active = false;
          }

          // Make sure to empty the range if suggestion is inactive
          if (!next.active) {
            next.decorationId = null;
            next.range = { from: 0, to: 0 };
            next.query = null;
            next.text = null;
          }

          return next;
        },
      },

      props: {
        // Call the keydown hook if suggestion is active.
        handleKeyDown(view, event) {
          const { active, range } = this.getState(view.state);

          if (!active) {
            return false;
          }

          return renderer?.onKeyDown?.({ view, event, range }) || false;
        },

        // Setup decorator on the currently active suggestion.
        decorations(state) {
          const { active, range, decorationId } = this.getState(state);

          if (!active) {
            return null;
          }

          return DecorationSet.create(state.doc, [
            Decoration.inline(range.from, range.to, {
              nodeName: config.decorationTag || 'span',
              class: config.decorationClass || 'kb-autocomplete--decor',
              'data-decoration-id': decorationId,
            }),
          ]);
        },
      },
    });
  }
}
