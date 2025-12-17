import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { type ExtensionMarkdown } from '@kerebron/extension-markdown';
import { type ExtensionAutocomplete } from '@kerebron/extension-autocomplete';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { LSPClient, Transport } from './LSPClient.ts';
import { AutocompletePlugin } from '@kerebron/extension-autocomplete/AutocompletePlugin';
import { DiagnosticPlugin } from './DiagnosticPlugin.ts';
import { createLspAutocomplete } from './createLspAutocomplete.ts';
import { LspSource } from './workspace.ts';

export type LspTransportGetter = (lang: string) => Transport | undefined;

export interface LspConfig {
  getLspTransport: LspTransportGetter;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';
  clients: Record<string, LSPClient> = {};
  uri: string | undefined;
  extensionMarkdown!: ExtensionMarkdown;
  extensionAutocomplete!: ExtensionAutocomplete;
  mainLang: string = 'markdown';
  source!: LspSource;

  constructor(protected override config: LspConfig) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    const plugins: Plugin[] = [];

    const { autocompleteConfig } = createLspAutocomplete(this);

    plugins.push(new AutocompletePlugin(autocompleteConfig, this.editor));
    plugins.push(new DiagnosticPlugin({}, this));

    return plugins;
  }

  override created() {
    this.mainLang = this.editor.config.languageID || 'markdown';

    this.source = {
      ui: this.editor.ui,
      getMappedContent: async () => {
        const editor = this.editor;
        const result = await this.extensionMarkdown.toMarkdown(
          editor.state.doc,
        );
        const mapper = new PositionMapper(editor, result.rawTextMap);
        return {
          ...result,
          mapper,
        };
      },
    };

    const extensionMarkdown: ExtensionMarkdown | undefined = this.editor
      .getExtension('markdown');
    if (!extensionMarkdown) {
      throw new Error('No markdown extension');
    }
    this.extensionMarkdown = extensionMarkdown;

    this.editor.addEventListener('doc:loaded', async () => {
      const languageID = this.mainLang;
      this.uri = this.editor.config.uri;
      if (this.uri) {
        const client = this.getClient(this.mainLang);
        if (client) {
          client.connect(this.uri, this.source);
          await client.restart();
          client.workspace.openFile(
            this.uri,
            languageID,
            this.source,
          );
        }
      }
    });

    this.editor.addEventListener('changed', () => {
      if (this.editor.config.uri) {
        const client = this.getClient(this.mainLang);
        if (client) {
          client.workspace.changedFile(
            this.editor.config.uri,
          );
        }
      }
    });

    this.editor.addEventListener('beforeDestroy', () => {
      if (this.uri) {
        const client = this.getClient(this.mainLang);
        if (client) {
          client.disconnect(this.uri);
        }
      }
    });
  }

  getClient(lang: string): LSPClient | undefined {
    if (!this.clients[lang]) {
      const transport = this.config.getLspTransport(lang);
      if (!transport) {
        console.warn(`No lsp transport for ${lang}`);
        return undefined;
      }
      this.clients[lang] = new LSPClient(transport, { rootUri: 'file:///' });
    }
    return this.clients[lang];
  }
}
