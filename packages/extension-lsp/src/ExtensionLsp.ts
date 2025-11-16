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

    let hasOpenedFile = false;
    let isConnecting = false;

    const tryOpenFile = async () => {
      if (hasOpenedFile || isConnecting || !this.editor.config.uri) {
        return;
      }

      const mappedContent = this.getMappedContent();
      const hasContent = mappedContent.content.trim().length > 0;

      // Only open the file if we have actual content or if we've waited long enough
      if (hasContent) {
        isConnecting = true;
        hasOpenedFile = true;
        const languageID = 'TODO';
        this.client.workspace.openFile(
          this.editor.config.uri,
          languageID,
          this.editor,
        );
        await this.client.restart();
        isConnecting = false;
      }
    };

    this.editor.addEventListener('doc:loaded', async () => {
      this.uri = this.editor.config.uri;
      // Try to open immediately if we have content
      await tryOpenFile();

      // If we didn't open (no content yet), set a timeout as fallback
      if (!hasOpenedFile && this.editor.config.uri) {
        setTimeout(async () => {
          if (!hasOpenedFile) {
            isConnecting = true;
            hasOpenedFile = true;
            const languageID = 'TODO';
            this.client.workspace.openFile(
              this.editor.config.uri!,
              languageID,
              this.editor,
            );
            await this.client.restart();
            isConnecting = false;
          }
        }, 1000); // Wait 1 second for YJS to sync
      }
    });

    this.editor.addEventListener('changed', async () => {
      if (!hasOpenedFile) {
        // Try to open the file now that content has changed
        await tryOpenFile();
      } else if (this.editor.config.uri) {
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
