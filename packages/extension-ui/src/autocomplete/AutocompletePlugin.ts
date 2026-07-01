import { Plugin, PluginKey, Selection, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { type CoreEditor } from '@kerebron/editor';

import { debounce } from '@kerebron/editor/utilities';

import {
  AutocompleteConfig,
  AutocompleteMatcher,
  AutocompleteProps,
  AutocompleteRenderer,
  AutocompleteSource,
  MatchedSource,
  SuggestionMatch,
  SuggestionProps,
} from './types.ts';
import { DefaultRenderer } from './DefaultRenderer.ts';
import { createDefaultMatcher } from './createDefaultMatcher.ts';

// type AutoCompleteStatexx =
//   | { type: "Idle" }
//   | { type: "Matched"; match: SuggestionMatch; source: AutocompleteSource }
//   | { type: "Suggesting"; text: string };

interface AutocompleteMeta {
  addAutocompleteSource?: {
    autocompleteSource: AutocompleteSource;
  };

  trigger?: {
    manual: boolean;
  };
  setRequest?: {
    match: SuggestionMatch;
    source: AutocompleteSource;
    // renderer: AutocompleteRenderer;
  };
  setResponse?: {
    items: any[];
  };

  clearRequest?: boolean;
}

class AutoCompleteState {
  idGenerator = 1;

  autocompleteSources: AutocompleteSource[] = [];
  manual: boolean = false;

  request?: {
    id: number;

    decorationId: string;

    match: SuggestionMatch;
    source: AutocompleteSource;
    renderer: AutocompleteRenderer;
  };

  response?: {
    items: any[];
  };

  composing: boolean = false;

  matchSource: typeof this.matchSourceImpl;

  constructor(private editor: CoreEditor) {
    this.matchSource = debounce(this.matchSourceImpl.bind(this), 200);
  }

  destroy() {
    if (this.request) {
      this.request.renderer.destroy();
    }
  }

  include(from: number) {
    if (!this.request) {
      return false;
    }

    if (from < this.request.match.range.from) return false;
    if (from > this.request.match.range.to) return false;

    return true;
  }

  addSource(source: AutocompleteSource) {
    if (!source.matchers && source.triggerKeys?.length === 1) {
      source.matchers = [
        createDefaultMatcher({ char: source.triggerKeys[0] }),
      ];
    }
    this.autocompleteSources.push(
      source,
    );
  }

  clearRequest() {
    if (this.request) {
      this.request.renderer.destroy();
      this.request = undefined;
    }
    this.response = undefined;
  }

  handleSource(matched?: MatchedSource) {
    // If we found a match, update the current state to show it
    if (
      matched && (!matched.source.allow || matched.source.allow({
        range: matched.match.range,
        isActive: !!this.request,
      }))
    ) {
      const { source, match } = matched;

      if (match) {
        this.dispatchMeta({
          setRequest: {
            match,
            source,
          },
        });
      }
    } else {
      this.clearRequest();
    }
  }

  docChanged() {
    this.matchSource({ manual: false });
    // for (const source of sources) {
    //   if (!source.matchers) {
    //     continue;
    //   }
    //   const matchers: AutocompleteMatcher[] = source.matchers;

    //   if (
    //     !['code_blocxk'].includes(parentNode.type.name)
    //   ) {
    //     for (const matcher of matchers) {
    //       const match = matcher(selection.$from);
    //       if (match) {
    //         matched = {
    //           source,
    //           match,
    //         };

    //         this.handleSource(matched);
    //         break;
    //         // return matched;
    //       }

    //     }

    //   }
    // }
    // throw new Error('Method not implemented.');
  }

  private matchSourceImpl({ manual }: { manual: boolean }): void {
    this.manual = manual;

    const selection: Selection = this.editor.state.selection;

    const sources: AutocompleteSource[] = this.autocompleteSources;
    let matched: MatchedSource | undefined = undefined;
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
          console.log('matchSourceImpl', source, match);
          if (match) {
            matched = {
              source,
              match,
            };

            this.handleSource(matched);
            break;
            // return matched;
          }
        }
      }
    }

    if (!matched) {
      this.dispatchMeta({ clearRequest: true });
    }

    return undefined;
  }

  handleCommands(
    pluginMeta: AutocompleteMeta | undefined,
    transaction: Transaction,
  ) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta?.addAutocompleteSource) {
      this.addSource({
        ...pluginMeta.addAutocompleteSource.autocompleteSource,
      });
      return true;
    }

    if (pluginMeta?.trigger) {
      const { selection } = transaction;

      this.matchSource(pluginMeta?.trigger);

      return true;
    }

    if (pluginMeta?.setRequest) {
      const id = this.idGenerator++;
      const decorationId = `id_${Math.floor(Math.random() * 0xffffffff)}`;

      let renderer = this.request?.renderer;
      if (this.request?.source !== pluginMeta.setRequest.source) {
        if (renderer) {
          renderer.destroy();
          renderer = undefined;
        }
      }
      if (!renderer) {
        renderer = new DefaultRenderer(this.editor);
        renderer.setAnchorSelector(`[data-decoration-id="${decorationId}"]`);

        if (this.request) {
          const onSelect = this.request.source.onSelect;
          renderer.setCommand((selected) => {
            console.log('COM', selected);
            if (!this.request) {
              return;
            }
            return onSelect(selected, this.request.match.range);
          });
        }
        renderer.addEventListener('close', () => {
          this.dispatchMeta({
            clearRequest: true,
          });
        });
      }

      this.request = {
        id,
        decorationId,
        match: pluginMeta.setRequest.match,
        source: pluginMeta.setRequest.source,
        renderer,
      };

      const request = this.request;

      const go = async () => {
        const ctx = {
          range: request.match.range,
          isActive: !!request,
        };
        const items = await request.source.getItems(
          request.match.query,
          ctx,
        );

        this.dispatchMeta({
          setResponse: {
            items,
          },
        });
      };
      go();

      return true;
    }

    if (pluginMeta?.setResponse && this.request) {
      this.response = {
        ...pluginMeta?.setResponse,
      };

      const props: SuggestionProps = {
        match: this.request.match,
        items: this.response.items,
        // anchor: ,
        // decorationNode,
        // virtual node for popper.js or tippy.js
        // this can be used for building popups without a DOM node
        // clientRect: () => {
        //   // because of `items` can be asynchrounous we’ll search for the current decoration node
        //   const { decorationId } = next; // eslint-disable-line
        //   const currentDecorationNode = view.dom.querySelector(
        //     `[data-decoration-id="${decorationId}"]`,
        //   );

        //   return currentDecorationNode?.getBoundingClientRect() ||
        //     null;
        // },
      };

      this.request?.renderer.onUpdate(props);

      return true;
    }

    if (pluginMeta?.clearRequest) {
      this.clearRequest();
      return true;
    }

    return false;
  }

  dispatchMeta(meta: AutocompleteMeta) {
    const tr = this.editor.state.tr;
    tr.setMeta(AutocompletePluginKey, meta);
    this.editor.dispatchTransaction(tr);
  }
}

export const AutocompletePluginKey = new PluginKey<AutoCompleteState>(
  'autocomplete',
);

export class AutocompletePlugin<Item, TSelected>
  extends Plugin<AutoCompleteState> {
  constructor(config: AutocompleteConfig, editor: CoreEditor) {
    super({
      key: AutocompletePluginKey,
      state: {
        init() {
          return new AutoCompleteState(editor);
        },

        apply(transaction, value: AutoCompleteState, prevState, state) {
          const pluginMeta: AutocompleteMeta | undefined = transaction.getMeta(
            AutocompletePluginKey,
          );

          const nextAutocompleteState = value;

          if (!pluginMeta && !transaction.isGeneric) {
            // return next;
          }

          const { editable, composing } = editor.view;
          const { selection } = transaction;

          nextAutocompleteState.composing = composing;

          if (!editable) {
            nextAutocompleteState.clearRequest();
            return nextAutocompleteState;
          }

          if (!selection.empty && !editor.view.composing) {
            nextAutocompleteState.clearRequest();
            return nextAutocompleteState;
          }

          if (nextAutocompleteState.handleCommands(pluginMeta, transaction)) {
            return nextAutocompleteState;
          }

          if (transaction.docChanged) {
            nextAutocompleteState.docChanged();
            // nextAutocompleteState.clearActive();
          }

          // Reset active state if we just left the previous suggestion range
          if (!composing && !nextAutocompleteState.include(selection.from)) {
            nextAutocompleteState.clearRequest();
            return nextAutocompleteState;
          }

          if (transaction.getMeta('isCommand')) {
            return nextAutocompleteState;
          }

          nextAutocompleteState.matchSource({ manual: false });

          return nextAutocompleteState;
        },
      },

      view(editorView) {
        return {
          update: async (view, prevState) => {
            const prev: AutoCompleteState = this.key?.getState(prevState);
            const next: AutoCompleteState = this.key?.getState(view.state);
            const pluginState = next;

            if (next.request?.decorationId) {
              const decorationNode = view.dom.querySelector(
                `[data-decoration-id="${next.request.decorationId}"]`,
              );
            }

            const moved = prev.request && next.request &&
              prev.request.match.range.from !== next.request.match.range.from;
            const started = !prev.request?.match && next.request?.match;
            const stopped = prev.request?.match && !next.request?.match;
            const changed = !started && !stopped &&
              prev.request?.match.query !== next.request?.match.query;

            if (stopped && prev.request) {
              prev.request.renderer.destroy();
              return;
            }

            if (next.activexxx) {
              for (const source of next.autocompleteSources) {
                if (!source.triggerKeys) {
                  pluginState.dispatchMeta({
                    trigger: {
                      manual: false,
                    },
                  });
                  return false;
                }
              }

              const changedQuery =
                prev.request?.match.query !== next.request.match.query;

              if (changedQuery || moved) {
                const decorationNode = view.dom.querySelector(
                  `[data-decoration-id="${next.request.decorationId}"]`,
                );

                const props: SuggestionProps = {
                  match: next.request.match,
                  items: [],
                  // anchor: ,
                  // decorationNode,
                  // virtual node for popper.js or tippy.js
                  // this can be used for building popups without a DOM node
                  // clientRect: () => {
                  //   // because of `items` can be asynchrounous we’ll search for the current decoration node
                  //   const { decorationId } = next; // eslint-disable-line
                  //   const currentDecorationNode = view.dom.querySelector(
                  //     `[data-decoration-id="${decorationId}"]`,
                  //   );

                  //   return currentDecorationNode?.getBoundingClientRect() ||
                  //     null;
                  // },
                };

                next.request.renderer.onUpdate(props);

                try {
                  const ctx = {
                    range: next.request.match.range,
                    isActive: !!next.request,
                  };
                  const items = await next.request.source.getItems(
                    next.request.match.query,
                    ctx,
                  );
                  next.request.renderer.onUpdate({ ...props, items });
                } catch (err: any) {
                  if (err.isLSP) {
                    console.error(
                      'LSP error config.getItems()',
                      err.message,
                      next.request.source.getItems,
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

            pluginState.destroy();
          },
        };
      },

      props: {
        // Call the keydown hook if suggestion is active.
        handleKeyDown(view, event) {
          const pluginState = this.getState(view.state) as AutoCompleteState;
          const { autocompleteSources } = pluginState;

          for (const source of autocompleteSources) {
            if (source.triggerKeys) {
              const triggerKeys: string[] = source.triggerKeys;
              for (const origKey of triggerKeys) {
                let key = origKey.toLowerCase();
                if (key.startsWith('ctrl+')) {
                  if (!event.ctrlKey) {
                    continue;
                  }
                  key = key.substring('ctrl+'.length);
                }

                if (key === event.key) {
                  pluginState.dispatchMeta({
                    trigger: {
                      manual: true,
                    },
                  });
                  return false;
                }
              }
            }
          }

          return false;
        },

        // Setup decorator on the currently active suggestion.
        decorations(state) {
          const { request, response } = this.getState(state) || {};

          if (!request) {
            return null;
          }

          const anchor = document.createElement('span');
          anchor.className = config.decorationClass || 'kb-autocomplete--decor';
          anchor.setAttribute('data-decoration-id', request.decorationId);

          return DecorationSet.create(state.doc, [
            Decoration.inline(
              request.match.range.from,
              request.match.range.to,
              {
                class: config.decorationClass || 'kb-autocomplete--decor',
                'data-decoration-id': request.decorationId,
                decorationId: request.decorationId,
              },
            ),
            // Decoration.widget(active.match.range.from, anchor, {
            //   class: anchor.className,
            //   decorationId,
            //   // refresh: () => active.renderer.refresh(),
            // }),
          ]);
        },
      },
    });
  }
}
