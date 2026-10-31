import { Plugin, PluginKey } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';

import { NodeCodeCell } from './NodeCodeCell.ts';
import { NotebookMeta, NotebookPluginState } from './NotebookPluginState.ts';

export * from './NodeCodeCell.ts';

export interface ExtensionNotebookConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export const NotebookPluginKey = new PluginKey<NotebookPluginState>('notebook');

export class ExtensionNotebook extends Extension {
  override name = 'notebook';

  nodeCodeCell = new NodeCodeCell({});
  requires = [
    this.nodeCodeCell,
  ];

  constructor(public override config: ExtensionNotebookConfig = {}) {
    super(config);
  }

  override created(): void {
    this.nodeCodeCell.config.languageWhitelist = this.config.languageWhitelist;
    this.nodeCodeCell.config.readOnly = this.config.readOnly;
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      new Plugin<NotebookPluginState>({
        key: NotebookPluginKey,
        state: {
          init(config, state) {
            const pluginState = new NotebookPluginState();
            return pluginState;
          },
          apply(tr, value, _oldState, state) {
            const pluginMeta: NotebookMeta | undefined = tr.getMeta('notebook');

            if (value.handleCommands(pluginMeta, tr)) {
              return value;
            }

            return value;
          },
        },
        view(view) {
          const pluginState = NotebookPluginKey.getState(view.state);
          return {
            destroy() {
              pluginState?.destroy();
            },
          };
        },
      }),
    ];
  }
}
