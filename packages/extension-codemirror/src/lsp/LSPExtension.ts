import { Extension } from '@codemirror/state';

import type { CoreEditor } from '@kerebron/editor';
import type { LSPClient } from '@kerebron/extension-lsp';

import { lspPlugin } from './plugin.ts';
import { lspTheme } from './theme.ts';

export interface LSPExtensionConfig {
  extensions?: readonly Extension[];
  getPos: () => number | undefined;
}

export class LSPExtension {
  extensions: Extension[] = [];

  constructor(
    readonly config: LSPExtensionConfig,
  ) {
    if (config.extensions) {
      for (const ext of config.extensions) {
        this.extensions.push(ext as Extension);
      }
    }
  }

  plugin(client: LSPClient, editor: CoreEditor): Extension {
    if (!editor.config.uri) {
      throw new Error('No editor.config.uri');
    }
    return [
      lspPlugin.of({ extension: this, editor, client, uri: editor.config.uri }),
      lspTheme,
      this.extensions,
    ];
  }
}
