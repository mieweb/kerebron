import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';

import type { LspConfig } from './ExtensionLsp.ts';
import { LSPSync } from './LSPSync.ts';

export const LSPPluginKey = new PluginKey<LSPSync>('lsp');

export class LSPPlugin extends Plugin<LSPSync> {
  constructor(config: LspConfig, editor: CoreEditor) {
    super({
      key: LSPPluginKey,
      state: {
        init() {
          return new LSPSync(config, editor);
        },
        apply(_tr: Transaction, value) {
          return value;
        },
      },
      view(view) {
        const pluginState = LSPPluginKey.getState(view.state);
        return {
          destroy() {
            pluginState?.destroy();
          },
        };
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          const pluginState = LSPPluginKey.getState(editor.state);

          if (pluginState) {
            state.doc.forEach((node, pos) => {
              const dom = (editor.view as EditorView).nodeDOM(
                pos,
              ) as HTMLElement;
              if (!dom || !dom.querySelector) {
                return;
              }

              const editorElement = dom.querySelector('[data-uri]');
              const uri = (editorElement
                ? editorElement.getAttribute('data-uri')
                : undefined) ||
                undefined;

              if (uri) {
                const diags = pluginState.uriToDiagnostics[uri];
                if (!diags) {
                  return;
                }
                const { diagnostics, version, contentMapper } = diags;

                if (version === editor.version) {
                  for (const diag of diagnostics) {
                    const from = contentMapper.fromLineChar(
                      diag.range.start.line,
                      diag.range.start.character,
                    );
                    const end = contentMapper.fromLineChar(
                      diag.range.end.line,
                      diag.range.end.character,
                    );

                    if (from > -1 && end > -1) {
                      const decoration = Decoration.inline(
                        pos + 1 + from,
                        pos + 1 + end,
                        {},
                        { class: 'kb-lsp__error', title: diag.message },
                      );
                      decorations.push(decoration);
                    }
                  }
                }
              }
            });
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    });
  }
}
