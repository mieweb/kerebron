import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { type ExtensionMarkdown } from '@kerebron/extension-markdown';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { LSPClient, Transport } from './LSPClient.ts';
import { LSPPlugin } from './LSPPlugin.ts';
import { createLspAutocomplete } from './createLspAutocomplete.ts';

export type LSPTransportGetter = (lang: string) => Transport | undefined;

export interface LspConfig {
  getLspTransport: LSPTransportGetter;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';
  clients: Record<string, LSPClient> = {};
  uri: string | undefined;
  extensionMarkdown!: ExtensionMarkdown;
  mainLang: string = 'markdown';
  // source!: LSPSource;

  constructor(public override config: LspConfig) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    const plugins: Plugin[] = [];

    const { autocompleteConfig } = createLspAutocomplete(this);

    plugins.push(new LSPPlugin(this.config, this));

    return plugins;
  }

  override created() {
    this.mainLang = this.editor.config.languageID || 'markdown';

    // this.source = {
    //   ui: this.editor.ui,
    //   getMappedContent: async () => {
    //     const editor = this.editor;
    //     const result = await this.extensionMarkdown.toMarkdown(
    //       editor.state.doc,
    //     );
    //     const mapper = new PositionMapper(editor, result.rawTextMap);
    //     return {
    //       ...result,
    //       mapper,
    //     };
    //   },
    // };

    const extensionMarkdown: ExtensionMarkdown | undefined = this.editor
      .ci.resolve('markdown');
    if (!extensionMarkdown) {
      throw new Error('No markdown extension');
    }
    this.extensionMarkdown = extensionMarkdown;

    this.editor.addEventListener('doc:loaded', async () => {
      this.uri = this.editor.config.uri;
      if (this.editor.config.uri) {
        const tr = this.editor.view.state.tr;
        tr.setMeta('workspace', {
          operation: 'openFile',
          node: this.editor.view.state.doc,
          // pos: this.getPos(),
          uri: this.editor.config.uri,
          lang: this.mainLang,
        });
        this.editor.view.dispatch(tr);
      }

      // TODO start autocomplete...
      // this.editor.chain()/aaaa.run();
    });

    this.editor.addEventListener('changed', () => {
      if (this.editor.config.uri) {
        const tr = this.editor.view.state.tr;
        tr.setMeta('workspace', {
          operation: 'modifyFile',
          node: this.editor.view.state.doc,
          // pos: this.getPos(),
          uri: this.editor.config.uri,
          lang: this.mainLang,
        });
        this.editor.view.dispatch(tr);
      }
    });

    this.editor.addEventListener('beforeDestroy', () => {
      if (this.uri) {
        const tr = this.editor.view.state.tr;
        tr.setMeta('workspace', {
          operation: 'closeFile',
          uri: this.editor.config.uri,
        });
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
