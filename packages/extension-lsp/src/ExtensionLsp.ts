import { Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension, TextRange } from '@kerebron/editor';
import { type ExtensionMarkdown } from '@kerebron/extension-markdown';
import {
  createRegexMatcher,
  type ExtensionAutocomplete,
} from '@kerebron/extension-autocomplete';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { createAutocompletePlugin } from './AutocompletePlugin.ts';
import { LSPClient, Transport } from './client.ts';
import { AutocompletePlugin } from '@kerebron/extension-autocomplete/AutocompletePlugin';
import { DefaultRenderer } from '../../extension-autocomplete/src/DefaultRenderer.ts';

export interface LspConfig {
  lspTransport?: Transport;
}

interface CompletionItem {
  label: string;
  detail: string;
  insertText: string;
}

class CustomRenderer extends DefaultRenderer<CompletionItem> {
  override createListItem(item: CompletionItem, cnt: number) { // override
    const li = document.createElement('li');
    if (cnt === this.pos) {
      li.classList.add('active');
    }
    li.innerText = item.label;
    li.title = item.detail;
    return li;
  }
}

export class ExtensionLsp extends Extension {
  name = 'lsp';
  client: LSPClient;
  uri: string | undefined;
  extensionMarkdown!: ExtensionMarkdown;
  extensionAutocomplete!: ExtensionAutocomplete;

  constructor(protected override config: LspConfig) {
    super(config);

    this.client = new LSPClient();
    if (config.lspTransport) {
      this.client.connect(config.lspTransport);
    }
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const plugins: Plugin[] = [];

    const renderer = new CustomRenderer(editor);

    const config = {
      renderer,
      matchers: [createRegexMatcher([/\w+/, /(^|\s)@\w*/, /^#\w*/])],
      getItems: async (query: string) => {
        const lspPos = { line: 0, character: 0 };

        const completions: { items: CompletionItem[] } | Array<CompletionItem> =
          await this.client.request('textDocument/completion', {
            textDocument: { uri: this.uri },
            position: lspPos,
            context: { triggerKind: 2, triggerCharacter: query },
          });

        if (Array.isArray(completions)) {
          return completions;
        }

        return completions.items;
      },
      onSelect: (selected: CompletionItem, range: TextRange) => {
        this.editor.chain().replaceRangeText(range, selected.insertText).run();
      },
    };

    const plugin = new AutocompletePlugin(config, editor);

    plugins.push(
      plugin,
    );

    return plugins;
  }

  override created() {
    const extensionMarkdown: ExtensionMarkdown | undefined = this.editor
      .getExtension('markdown');
    if (!extensionMarkdown) {
      throw new Error('No markdown extension');
    }
    this.extensionMarkdown = extensionMarkdown;

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
    });
  }

  getMappedContent() {
    const result = this.extensionMarkdown.toMarkdown(this.editor.state.doc);

    const mapper = new PositionMapper(this.editor, result.markdownMap);
    return {
      ...result,
      mapper,
    };

    // this.from = mapper.toMarkDownPos(selection.from);
    // this.to = mapper.toMarkDownPos(selection.to);
  }

  getClient(): LSPClient {
    return this.client;
  }
}
