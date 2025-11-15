import { Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { type ExtensionMarkdown } from '@kerebron/extension-markdown';
import { type ExtensionAutocomplete } from '@kerebron/extension-autocomplete';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { LSPClient, Transport } from './LSPClient.ts';
import { AutocompletePlugin } from '@kerebron/extension-autocomplete/AutocompletePlugin';
import { DiagnosticPlugin } from './DiagnosticPlugin.ts';
import { createLspAutocomplete } from './createLspAutocomplete.ts';

export interface LspConfig {
  lspTransport: Transport;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';
  client: LSPClient;
  uri: string | undefined;
  extensionMarkdown!: ExtensionMarkdown;
  extensionAutocomplete!: ExtensionAutocomplete;

  constructor(protected override config: LspConfig) {
    super(config);

    this.client = new LSPClient(config.lspTransport);
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const plugins: Plugin[] = [];

    const { autocompleteConfig } = createLspAutocomplete(this);

    plugins.push(new AutocompletePlugin(autocompleteConfig, editor));
    plugins.push(new DiagnosticPlugin({}, this));

    return plugins;
  }

  override created() {
    const extensionMarkdown: ExtensionMarkdown | undefined = this.editor
      .getExtension('markdown');
    if (!extensionMarkdown) {
      throw new Error('No markdown extension');
    }
    this.extensionMarkdown = extensionMarkdown;

    this.editor.addEventListener('doc:loaded', async () => {
      // const doc = ev.detail.doc;
      // if (!languageID) {
      //   let lang = view.state.facet(language);
      //   languageID = lang ? lang.name : '';
      // }
      const languageID = 'TODO';
      this.uri = this.editor.config.uri;
      if (this.editor.config.uri) {
        await this.client.restart();
        this.client.workspace.openFile(
          this.editor.config.uri,
          languageID,
          this.editor,
        );
      }
    });

    this.editor.addEventListener('changed', async () => {
      if (this.editor.config.uri) {
        this.client.workspace.changedFile(
          this.editor.config.uri,
        );
      }
    });

    this.editor.addEventListener('beforeDestroy', async () => {
      if (this.uri) {
        this.client.disconnect();
      }
    });
  }

  getMappedContent() {
    const result = this.extensionMarkdown.toMarkdown(this.editor.state.doc);

    const mapper = new PositionMapper(this.editor, result.markdownMap);
    return {
      ...result,
      mapper,
    };
  }

  getClient(): LSPClient {
    return this.client;
  }
}
