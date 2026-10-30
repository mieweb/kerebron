import { Plugin, PluginKey } from 'prosemirror-state';

import { type CoreEditor } from '@kerebron/editor';

import { AutocompleteConfig } from './types.ts';
import { AutocompleteMeta, AutoCompleteState } from './AutoCompleteState.ts';
import { autoDecorationSet } from '../utilities/autoDecorationSet.ts';

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
          const newState = new AutoCompleteState(editor);
          const prevState = AutocompletePluginKey.getState(editor.state);
          if (prevState) { // preserve config after loadDocument
            for (const source of prevState.autocompleteSources) {
              newState.autocompleteSources.push(source);
            }
          }
          return newState;
        },

        apply(
          transaction,
          pluginState: AutoCompleteState,
          prevState,
          newState,
        ) {
          const pluginMeta: AutocompleteMeta | undefined = transaction.getMeta(
            AutocompletePluginKey,
          );

          const { editable, composing } = editor.view;
          const { selection } = transaction;

          if (!editable) {
            pluginState.clearRequest();
            return pluginState;
          }

          if (!selection.empty && !editor.view.composing) {
            pluginState.clearRequest();
            return pluginState;
          }

          console.group('handleCommands');
          if (pluginState.handleCommands(pluginMeta, transaction)) {
            console.groupEnd();
            return pluginState;
          }
          console.groupEnd();

          // Reset active state if we just left the previous suggestion range
          if (!composing && !pluginState.include(selection.from)) {
            pluginState.clearRequest();
          }

          if (transaction.getMeta('isCommand')) {
            return pluginState;
          }

          if (transaction.docChanged) {
            pluginState.clearRequest();
            if (newState.selection.empty) {
              pluginState.onEdit(newState.selection.$from);
            }
          }

          return pluginState;
        },
      },

      view(editorView) {
        return {
          destroy: () => {
            const pluginState = AutocompletePluginKey.getState(editor.state);
            pluginState?.destroy();
          },
        };
      },

      props: {
        // Call the keydown hook if suggestion is active.
        handleKeyDown(view, event) {
          const pluginState = this.getState(view.state);
          if (!pluginState) {
            return;
          }
          const { autocompleteSources } = pluginState;

          for (const source of autocompleteSources) {
            console.log('sss', source.triggerKeys);
            if (source.triggerKeys) {
              const triggerKeys: string[] = source.triggerKeys;
              for (const origKey of triggerKeys) {
                let key = origKey.toLowerCase();
                if (key.startsWith('ctrl-')) {
                  if (!event.ctrlKey) {
                    continue;
                  }
                  key = key.substring('ctrl-'.length);
                }

                if (key === event.key) {
                  console.log('onKeyDown', view.state.selection.$from);
                  pluginState.onKeyDown(view.state.selection.$from, origKey);
                  return false;
                }
              }
            }
          }

          return false;
        },

        decorations(state) {
          const { request } = this.getState(state) || {};

          if (!request) {
            return null;
          }

          const attrs = {
            class: config.decorationClass || 'kb-autocomplete--decor',
            'data-anchor': `--autocomplete${request.id}`,
            style: `anchor-name: --autocomplete${request.id};`,
          };
          return autoDecorationSet(state, request.range, attrs);
        },
      },
    });
  }
}
