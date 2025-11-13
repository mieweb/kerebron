import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { ExtensionLsp } from './ExtensionLsp.ts';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

interface LspRange {
  line: number;
  character: number;
}

interface DiagnosticsItem {
  severity: number;
  range: {
    start: LspRange;
    end: LspRange;
  };
  message: string;
  source: string;
  code: string;
  data: any; // "data":{"kind":"todo","keyword":"TODO"}},
}

interface DiagnosticPluginState {
  diagnostics: DiagnosticsItem[];
  mapper?: PositionMapper;
}

interface DiagnosticConfig {
}

export const DiagnosticPluginKey = new PluginKey('lsp-diagnostic');

export class DiagnosticPlugin extends Plugin<DiagnosticPluginState> {
  listener: ((event: Event) => void) | undefined;

  constructor(config: DiagnosticConfig, extension: ExtensionLsp) {
    super({
      key: DiagnosticPluginKey,
      view(view) {
        return {
          destroy: () => {
            if (this.listener) {
              extension.client.addEventListener(
                'textDocument/publishDiagnostics',
                this.listener,
              );
            }
          },
        };
      },
      state: {
        init() {
          return {
            diagnostics: [],
          };
        },
        apply(
          tr: Transaction,
          prev: DiagnosticPluginState,
          oldState,
          newState,
        ) {
          const next = { ...prev };

          const meta = tr.getMeta(DiagnosticPluginKey);
          console.log('meta', meta);
          if (meta?.diagnostics) {
            next.diagnostics = meta.diagnostics;
          }
          if (meta?.mapper) {
            next.mapper = meta.mapper;
          }

          return next;
        },
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          const pluginState = this.getState(state);
          if (pluginState) {
            const { diagnostics, mapper } = pluginState;

            if (mapper) {
              for (const diag of diagnostics) {
                const from = mapper.fromLineChar(
                  diag.range.start.line,
                  diag.range.start.character,
                );
                const end = mapper.fromLineChar(
                  diag.range.end.line,
                  diag.range.end.character,
                );

                if (from > -1 && end > -1) {
                  decorations.push(
                    Decoration.inline(
                      from,
                      end,
                      { class: 'kb-lsp__error', title: diag.message },
                    ),
                  );
                }
              }
            }
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    });

    const editor = extension.getEditor();

    const uri = editor.config.uri;
    if (uri) {
      this.listener = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.params.uri !== uri) {
          return;
        }

        event.preventDefault();

        const file = extension.client.workspace.getFile(uri);
        if (file) {
          const { mapper } = file;

          const tr = editor.view.state.tr.setMeta(DiagnosticPluginKey, {
            diagnostics: detail.params.diagnostics,
            mapper,
          });
          editor.view.dispatch(tr);
        }
      };

      extension.client.addEventListener(
        'textDocument/publishDiagnostics',
        this.listener,
      );
    }
  }
}
