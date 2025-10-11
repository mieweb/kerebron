import {
  Command,
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
} from 'prosemirror-state';
import { MarkType, NodeType, Schema } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Transport } from '@codemirror/lsp-client';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { createAutocompletePlugin } from './AutocompletePlugin.ts';

export interface LspConfig {
  lspTransport?: Transport;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';

  constructor(protected override config: LspConfig) {
    super(config);
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const plugins: Plugin[] = [];

    plugins.push(
      createAutocompletePlugin(this.config.lspTransport, 'file:///example.txt'),
      // keymap({ 'Esc': () => true }) // Handle escape to close suggestions
    );

    return plugins;
  }
}
