import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { type CoreEditor } from '@kerebron/editor';

import {
  AutocompleteConfig,
  AutocompleteMatcher,
  AutocompleteRenderer,
  AutocompleteSource,
  MatchedSource,
  SuggestionMatch,
  SuggestionProps,
} from './types.ts';
import { DefaultRenderer } from './DefaultRenderer.ts';
import { createDefaultMatcher } from './createDefaultMatcher.ts';

interface AutoCompleteState {
  autocompleteSources: AutocompleteSource[];
  manual: boolean;

  active?: {
    match: SuggestionMatch;
    source: AutocompleteSource;
    renderer: AutocompleteRenderer;
  };

  composing: boolean;
  decorationId?: string;
}

interface AutocompleteMeta {
  addAutocompleteSource?: {
    autocompleteSource: AutocompleteSource;
  };
  activate?: boolean;
  deactivate?: boolean;
}

export const AutocompletePluginKey = new PluginKey<AutoCompleteState>(
  'autocomplete',
);

function matchSource(selection: Selection, sources: AutocompleteSource[]) {
  let matched: MatchedSource = undefined;
  const parentNode = selection.$anchor.parent;

  for (const source of sources) {
    if (!source.matchers) {
      continue;
    }
    const matchers: AutocompleteMatcher[] = source.matchers;

    if (
      !['code_blocxk'].includes(parentNode.type.name)
    ) {
      for (const matcher of matchers) {
        const match = matcher(selection.$from);
        if (match) {
          matched = {
            source,
            match,
          };
          return matched;
        }
      }
    }
  }
  return undefined;
}

export class AutocompletePlugin<Item, TSelected>
  extends Plugin<AutoCompleteState> {
  constructor(config: AutocompleteConfig, editor: CoreEditor) {
    super({
      key: AutocompletePluginKey,
      state: {
        // Initialize the plugin's internal state.
        init() {
          const state: AutoCompleteState = {
            autocompleteSources: [],
            manual: false,
            active: undefined,
            composing: false,
          };

          return state;
        },

        // Apply changes to the plugin state from a view transaction.
        apply(transaction, value, prevState, state) {
          const pluginMeta: AutocompleteMeta | undefined = transaction.getMeta(
            AutocompletePluginKey,
          );

          const next = { ...value };

          if (!pluginMeta && !transaction.isGeneric) {
            // return next;
          }

          const { editable, composing } = editor.view;
          const { selection } = transaction;

          const clearActive = () => {
            if (next.active) {
              next.active.renderer.destroy();
              next.active = undefined;
            }
            next.decorationId = undefined;
          };

          const handleSource = (matched?: MatchedSource) => {
            // If we found a match, update the current state to show it
            if (
              matched && (!matched.source.allow || matched.source.allow({
                range: matched.match.range,
                isActive: !!next.active,
              }))
            ) {
              const { source, match } = matched;

              console.info('Trigger matcher autocomplete', match);

              let renderer = next.active?.renderer;
              if (next.active?.source !== source) {
                if (renderer) {
                  renderer.destroy();
                  renderer = undefined;
                }
              }
              if (!renderer) {
                renderer = new DefaultRenderer(editor);
                renderer.addEventListener('close', () => {
                  const tr = editor.state.tr.setMeta(AutocompletePluginKey, {
                    deactivate: true,
                  });
                  console.info('Manual autocomplete deactivate');
                  editor.view.dispatch(tr);
                });
              }

              next.active = {
                renderer,
                source,
                match,
              };

              const decorationId = `id_${
                Math.floor(Math.random() * 0xffffffff)
              }`;
              next.decorationId = next.decorationId || decorationId; // ???
            } else {
              clearActive();
            }
          };

          if (pluginMeta?.addAutocompleteSource) {
            const source = {
              ...pluginMeta.addAutocompleteSource.autocompleteSource,
            };
            if (!source.matchers && source.triggerKeys?.length === 1) {
              source.matchers = [
                createDefaultMatcher({ char: source.triggerKeys[0] }),
              ];
            }
            next.autocompleteSources.push(
              source,
            );
            return next;
          }

          if (pluginMeta?.activate) {
            console.info('Trigger manual autocomplete');

            const matched = matchSource(selection, next.autocompleteSources);
            handleSource(matched);
            next.manual = true;
            return next;
          }

          if (pluginMeta?.deactivate) {
            console.info('Deactivate autocomplete');
            clearActive();
            return next;
          }

          if (!editable) {
            clearActive();
            return next;
          }

          if (!selection.empty && !editor.view.composing) {
            clearActive();
            return next;
          }

          // Reset active state if we just left the previous suggestion range
          if (
            next.active && !composing && !next.composing &&
            (selection.from < next.active.match.range.from ||
              selection.from > next.active.match.range.to)
          ) {
            clearActive();
          }

          next.composing = composing;

          if (transaction.getMeta('isCommand')) {
            return next;
          }

          const matched = matchSource(selection, next.autocompleteSources);
          handleSource(matched);
          next.manual = false;

          return next;
        },
      },

      view() {
        return {
          update: async (view, prevState) => {
            const prev: AutoCompleteState = this.key?.getState(prevState);
            const next: AutoCompleteState = this.key?.getState(view.state);

            const moved = prev.active && next.active &&
              prev.active.match.range.from !== next.active.match.range.from;
            const started = !prev.active?.match && next.active?.match;
            const stopped = prev.active?.match && !next.active?.match;
            const changed = !started && !stopped &&
              prev.active?.match.query !== next.active?.match.query;

            if (stopped && prev.active) {
              prev.active.renderer.destroy();
              return;
            }

            if (next.active) {
              const changedQuery =
                prev.active?.match.query !== next.active.match.query;

              if (changedQuery || moved) {
                const decorationNode = view.dom.querySelector(
                  `[data-decoration-id="${next.decorationId}"]`,
                );

                const onSelect = next.active.source.onSelect;
                const range = next.active.match.range;

                const props: SuggestionProps = {
                  match: next.active.match,
                  items: [],
                  command: (selected) => {
                    return onSelect(selected, range);
                  },
                  // decorationNode,
                  // virtual node for popper.js or tippy.js
                  // this can be used for building popups without a DOM node
                  clientRect: () => {
                    // because of `items` can be asynchrounous we’ll search for the current decoration node
                    const { decorationId } = next; // eslint-disable-line
                    const currentDecorationNode = view.dom.querySelector(
                      `[data-decoration-id="${decorationId}"]`,
                    );

                    return currentDecorationNode?.getBoundingClientRect() ||
                      null;
                  },
                };

                next.active.renderer.onUpdate(props);

                try {
                  const ctx = {
                    range: next.active.match.range,
                    isActive: !!next.active,
                  };
                  const items = await next.active.source.getItems(
                    next.active.match.query,
                    ctx,
                  );
                  next.active.renderer.onUpdate({ ...props, items });
                } catch (err: any) {
                  if (err.isLSP) {
                    console.error(
                      'LSP error config.getItems()',
                      err.message,
                      next.active.source.getItems,
                    );
                  } else {
                    throw err;
                  }
                }
              }
            }

            const handleStart = started || (moved && changed);
            const handleChange = changed || moved;
            const handleExit = stopped || (moved && changed);

            if (!handleStart && !handleChange && !handleExit) {
              return;
            }

            const state = handleExit && !handleStart ? prev : next;

            // const active = state.active;
          },

          destroy: () => {
            const pluginState = AutocompletePluginKey.getState(editor.state);
            if (!pluginState) {
              return;
            }

            const { active } = pluginState;
            if (active) {
              active.renderer.destroy();
            }
          },
        };
      },

      props: {
        // Call the keydown hook if suggestion is active.
        handleKeyDown(view, event) {
          const pluginState = this.getState(view.state) as AutoCompleteState;
          const { autocompleteSources } = pluginState;

          for (const source of autocompleteSources) {
            const triggerKeys: string[] = [...(source.triggerKeys || [])];
            for (const origKey of triggerKeys) {
              let key = origKey.toLowerCase();
              if (key.startsWith('ctrl+')) {
                if (!event.ctrlKey) {
                  continue;
                }
                key = key.substring('ctrl+'.length);
              }

              if (key === event.key) {
                const tr = view.state.tr.setMeta(AutocompletePluginKey, {
                  activate: true,
                });
                console.info('Manual autocomplete key ' + origKey);
                view.dispatch(tr);
                return false;
              }
            }
          }

          return false;
        },

        // Setup decorator on the currently active suggestion.
        decorations(state) {
          const { active, decorationId } = this.getState(state) || {};

          if (!active || !decorationId) {
            return null;
          }

          const node = document.createElement('span');
          node.className = config.decorationClass || 'kb-autocomplete--decor';
          node.setAttribute('data-decoration-id', decorationId);

          return DecorationSet.create(state.doc, [
            Decoration.widget(active.match.range.from, node, {
              class: node.className,
              decorationId,
              refresh: () => active.renderer.refresh(),
            }),
          ]);
        },
      },
    });
  }
}
