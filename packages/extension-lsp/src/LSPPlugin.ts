import { Plugin, PluginKey, Transaction } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';

import type { LspConfig } from './ExtensionLsp.ts';
import { LSPSync } from './LSPSync.ts';

export const LSPPluginKey = new PluginKey<LSPSync>('lsp');

export class LSPPlugin extends Plugin<LSPSync> {
  constructor(config: LspConfig, editor: CoreEditor) {
    super({
      key: LSPPluginKey,
      state: {
        init() {
          return new LSPSync(config, editor);
        },
        apply(_tr: Transaction, value) {
          return value;
        },
      },
      view(view) {
        const pluginState = LSPPluginKey.getState(view.state);
        return {
          destroy() {
            pluginState?.destroy();
          },
        };
      },
    });
  }
}
