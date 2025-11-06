import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionList,
  MessageConnection,
} from 'vscode-languageserver-protocol';

import { ExtensionLsp } from '@kerebron/extension-lsp';
import { CoreEditor } from '@kerebron/editor';

const autocompleteKey = new PluginKey('autocomplete');

export function createAutocompletePlugin(
  editor: CoreEditor,
  docId: string,
) {
  let suggestionWidget: HTMLElement | null = null;

  // Helper to create suggestion UI
  function showSuggestions(view: EditorView, items: any[], pos: number) {
    if (suggestionWidget) suggestionWidget.remove();
    suggestionWidget = document.createElement('div');
    suggestionWidget.className = 'autocomplete-suggestions';
    suggestionWidget.style.position = 'absolute';
    suggestionWidget.style.background = '#fff';
    suggestionWidget.style.border = '1px solid #ccc';
    suggestionWidget.style.zIndex = '1000';

    items.forEach((item) => {
      const option = document.createElement('div');
      option.textContent = item.label;
      option.style.padding = '2px 5px';
      option.style.cursor = 'pointer';
      option.addEventListener('click', () => {
        view.dispatch(view.state.tr.insertText(item.label, pos - 1, pos)); // Apply completion
        closeSuggestions();
      });
      suggestionWidget!.appendChild(option);
    });

    // Position near cursor
    const coords = view.coordsAtPos(pos);
    suggestionWidget.style.top = `${coords.bottom}px`;
    suggestionWidget.style.left = `${coords.left}px`;
    document.body.appendChild(suggestionWidget);
  }

  function closeSuggestions() {
    if (suggestionWidget) {
      suggestionWidget.remove();
      suggestionWidget = null;
    }
  }

  return new Plugin({
    key: autocompleteKey,
    state: {
      init() {
        return { active: false, pos: null };
      },
      apply(tr, state) {
        return state;
      },
    },
    props: {
      handleKeyDown(view, event) {
        if (event.key === 'Escape' && suggestionWidget) {
          closeSuggestions();
          return true;
        }
        return false;
      },
      handleTextInput(view, from, to, text) {
        const extensionLsp: ExtensionLsp | undefined = editor.getExtension(
          'lsp',
        );
        if (!extensionLsp) {
          return false;
        }
        const client = extensionLsp.getClient();

        // Trigger autocomplete on specific characters (e.g., '.')
        if (text === '.' || text === ':') {
          const docText = view.state.doc.textBetween(
            0,
            view.state.doc.content.size,
            '\n',
          );
          const doc = TextDocument.create(docId, 'plaintext', 0, docText);
          const pos = view.state.selection.from;

          // Convert ProseMirror position to LSP position
          const lspPos = doc.positionAt(pos - 1);

          // Request completions from LSP
          client.request('textDocument/completion', {
            textDocument: { uri: docId },
            position: lspPos,
            context: { triggerKind: 2, triggerCharacter: text },
          }).then((completions: any) => {
            // const completions = result.items;
            // const completions = result ? (CompletionList.is(result) ? result.items : result) : [];
            if (completions.length > 0) {
              showSuggestions(view, completions, pos);
            }
          });
        }
        return false;
      },
    },
    view() {
      return {
        destroy() {
          closeSuggestions();
        },
      };
    },
  });
}
