import { Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension, TextRange } from '@kerebron/editor';
import { type ExtensionMarkdown } from '@kerebron/extension-markdown';
import {
  type AutocompleteProps,
  createRegexMatcher,
  type ExtensionAutocomplete,
} from '@kerebron/extension-autocomplete';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { LSPClient, Transport } from './LSPClient.ts';
import { AutocompletePlugin } from '@kerebron/extension-autocomplete/AutocompletePlugin';
import { DefaultRenderer } from '../../extension-autocomplete/src/DefaultRenderer.ts';
import { DiagnosticPlugin } from './DiagnosticPlugin.ts';

export interface LspConfig {
  lspTransport: Transport;
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
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      this.command(item);
    });
    return li;
  }
}

export function cleanPlaceholders(input: string): string {
  const regex = /\$\{\d+:([^}]+)}/g;
  return input.replace(regex, '$1');
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

    const renderer = new CustomRenderer(editor);

    const config = {
      renderer,
      matchers: [createRegexMatcher([/\w+/, /(^|\s)@\w*/, /^#\w*/])],
      getItems: async (query: string, props: AutocompleteProps) => {
        const { mapper } = this.getMappedContent();

        const lspPos = mapper.toMarkDownLspPos(props.range.from);

        this.client.sync();
        try {
          const completions:
            | { items: CompletionItem[] }
            | Array<CompletionItem> = await this.client.request(
              'textDocument/completion',
              {
                textDocument: { uri: this.uri },
                position: lspPos,
                context: { triggerKind: 2, triggerCharacter: query },
              },
            );

          if (Array.isArray(completions)) {
            return completions;
          }

          return completions.items;
        } catch (err: any) {
          console.error(err.message);
          return [];
        }
      },
      onSelect: (selected: CompletionItem, range: TextRange) => {
        const rawText = cleanPlaceholders(selected.insertText);
        const slice = this.extensionMarkdown.fromMarkdown(rawText);

        if (slice.content.content.length === 1) {
          const first = slice.content.content[0];
          if (first.isBlock) {
            this.editor.chain().insertBlockSmart(range.from, first).run();
            return;
          }
        }

        this.editor.chain().replaceRangeSlice(range, slice).run();
      },
    };

    plugins.push(new AutocompletePlugin(config, editor));
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
