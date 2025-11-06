import {
  Command,
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
} from 'prosemirror-state';
import { MarkType, NodeType, Schema } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { createAutocompletePlugin } from './AutocompletePlugin.ts';
import { LSPClient, Transport } from './client.ts';

export interface LspConfig {
  lspTransport?: Transport;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';
  client: LSPClient;
  uri: string | undefined;

  constructor(protected override config: LspConfig) {
    super(config);

    this.client = new LSPClient();
    if (config.lspTransport) {
      this.client.connect(config.lspTransport);
    }
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const plugins: Plugin[] = [];

    plugins.push(
      createAutocompletePlugin(editor, 'file:///example.txt'),
      // keymap({ 'Esc': () => true }) // Handle escape to close suggestions
    );

    return plugins;
  }

  override created() {
    this.editor.addEventListener('doc:loaded', async (ev: CustomEvent) => {
      // const doc = ev.detail.doc;
      // if (!languageID) {
      //   let lang = view.state.facet(language);
      //   languageID = lang ? lang.name : '';
      // }
      const languageID = 'TODO';
      this.uri = this.editor.config.uri;
      if (this.editor.config.uri) {
        this.client.workspace.openFile(
          this.editor.config.uri,
          languageID,
          this.editor,
        );
      }
    });

    this.editor.addEventListener('beforeDestroy', async (ev: CustomEvent) => {
      if (this.uri) {
        this.client.workspace.closeFile(this.uri);
      }
      this.client.activeMappings = this.client.activeMappings.filter((m) =>
        m != this
      );
    });
  }

  getClient(): LSPClient {
    return this.client;
  }
}
