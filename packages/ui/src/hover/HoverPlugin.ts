import { Plugin, PluginKey } from 'prosemirror-state';

import { type CoreEditor } from '@kerebron/editor';

import { HoverConfig } from './types.ts';
import { HoverMeta, HoverState } from './HoverState.ts';
import { autoDecorationSet } from '../utilities/autoDecorationSet.ts';

export const HoverPluginKey = new PluginKey<HoverState>(
  'hover',
);

export class HoverPlugin<Item, TSelected> extends Plugin<HoverState> {
  constructor(config: HoverConfig, editor: CoreEditor) {
    super({
      key: HoverPluginKey,
      state: {
        init() {
          const newState = new HoverState(editor);
          const prevState = HoverPluginKey.getState(editor.state);
          if (prevState) { // preserve config after loadDocument
            for (const source of prevState.hoverSources) {
              newState.hoverSources.push(source);
            }
          }
          return newState;
        },

        apply(transaction, pluginState: HoverState, prevState, newState) {
          if (transaction.docChanged) {
            pluginState.clearRequest();
          }

          const oldPos = prevState.selection.from;
          const newSelection = newState.selection;

          if (
            pluginState.navigationPending && newSelection.empty &&
            oldPos !== newSelection.from
          ) {
            pluginState.clearRequest();
            pluginState.onKeyboardNav(newSelection.$from);
          }

          pluginState.navigationPending = false;

          if (transaction.isGeneric) {
            return pluginState;
          }

          const pluginMeta: HoverMeta | undefined = transaction.getMeta(
            HoverPluginKey,
          );

          if (pluginState.handleCommands(pluginMeta, transaction)) {
            return pluginState;
          }

          return pluginState;
        },
      },

      view() {
        return {
          destroy: () => {
            const pluginState = HoverPluginKey.getState(editor.state);
            pluginState?.destroy();
          },
        };
      },

      props: {
        handleKeyDown(view, event) {
          const pluginState = HoverPluginKey.getState(editor.state);
          if (!pluginState) {
            return;
          }

          pluginState.navigationPending = [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
          ].includes(event.key);

          return false;
        },
        handleDOMEvents: {
          mousemove: (view, event) => {
            const pluginState = HoverPluginKey.getState(editor.state);
            pluginState?.onMouseMove(view, event);
            return;
          },
          mouseleave: (view, event) => {
            const pluginState = HoverPluginKey.getState(editor.state);
            pluginState?.onMouseLeave(view, event);
            return;
          },
        },

        decorations(state) {
          const { request, response } = this.getState(state) || {};

          if (!request) {
            return null;
          }

          const attrs = {
            class: config.decorationClass || 'kb-hover--decor',
            'data-anchor': `--hover${request.id}`,
            style: `anchor-name: --hover${request.id};`,
          };
          return autoDecorationSet(state, request.range, attrs);
        },
      },
    });
  }
}
