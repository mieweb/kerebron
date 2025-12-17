import { DefaultRenderer } from '@kerebron/extension-autocomplete/DefaultRenderer';
import { type CoreEditor, TextRange } from '@kerebron/editor';

import {
  type AutocompleteProps,
  createRegexMatcher,
} from '@kerebron/extension-autocomplete';

import { ExtensionLsp } from './ExtensionLsp.ts';

interface CompletionItem {
  label: string;
  detail: string;
  insertText: string;
}

export class CustomRenderer extends DefaultRenderer<CompletionItem> {
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

export function createLspAutocomplete(extensionLsp: ExtensionLsp) {
  const editor: CoreEditor = extensionLsp.getEditor();
  const renderer = new CustomRenderer(editor);

  const config = {
    renderer,
    matchers: [createRegexMatcher([/\w+/, /(^|\s)@\w*/, /^#\w*/])],
    getItems: async (query: string, props: AutocompleteProps) => {
      const { mapper } = await extensionLsp.source.getMappedContent();

      const lspPos = mapper.toRawTextLspPos(props.range.from);

      const client = extensionLsp.getClient(extensionLsp.mainLang);
      if (client) {
        client.sync();
        try {
          const completions:
            | { items: CompletionItem[] }
            | Array<CompletionItem> = await client.request(
              'textDocument/completion',
              {
                textDocument: { uri: extensionLsp.uri },
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
      } else {
        return [];
      }
    },
    onSelect: async (selected: CompletionItem, range: TextRange) => {
      const rawText = cleanPlaceholders(selected.insertText);
      const slice = await extensionLsp.extensionMarkdown.fromMarkdown(rawText);

      if (slice.content.content.length === 1) {
        const first = slice.content.content[0];
        if (first.isBlock) {
          editor.chain().insertBlockSmart(range.from, first).run();
          return;
        }
      }

      editor.chain().replaceRangeSlice(range, slice).run();
    },
  };

  return { autocompleteConfig: config };
}
