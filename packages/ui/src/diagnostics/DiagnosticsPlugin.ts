import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { type CoreEditor } from '@kerebron/editor';

import { Diagnostic, DiagnosticsConfig, DiagnosticsSource } from './types.ts';

export const DiagnosticsPluginKey = new PluginKey<DiagnosticsState>(
  'diagnostics',
);

export class DiagnosticsState {
  diagnosticsSources: DiagnosticsSource[] = [];

  uriToDiagnostics: Record<
    string,
    {
      diagnostics: Diagnostic[];
      version: number;
      // contentMapper: ContentMapper;
    }
  > = {};

  handleCommands(
    pluginMeta: DiagnosticsMeta | undefined,
    transaction: Transaction,
  ) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta?.publishDiagnostics) {
      this.uriToDiagnostics[pluginMeta?.publishDiagnostics.uri] = pluginMeta
        ?.publishDiagnostics;
      return true;
    }

    return false;
  }
}

export interface DiagnosticsMeta {
  addDiagnosticsSource?: {
    diagnosticsSource: DiagnosticsSource;
  };

  publishDiagnostics?: {
    uri: string;
    version: number;
    diagnostics: Diagnostic[];
  };

  activate?: boolean;
  deactivate?: boolean;
}

export class DiagnosticsPlugin<Item, TSelected>
  extends Plugin<DiagnosticsState> {
  // timeout: undefined | ReturnType<typeof setTimeout>;
  // lastEvent: undefined | MouseEvent;

  constructor(config: DiagnosticsConfig, editor: CoreEditor) {
    super({
      key: DiagnosticsPluginKey,
      state: {
        init() {
          const newState = new DiagnosticsState();
          const prevState = DiagnosticsPluginKey.getState(editor.state);
          if (prevState) { // preserve config after loadDocument
            for (const source of prevState.diagnosticsSources) {
              newState.diagnosticsSources.push(source);
            }
          }
          return newState;
        },

        apply(tr, pluginState, oldState, newState) {
          const pluginMeta: DiagnosticsMeta | undefined = tr.getMeta(
            DiagnosticsPluginKey,
          );

          if (pluginState.handleCommands(pluginMeta, tr)) {
            return pluginState;
          }

          if (!tr.docChanged) {
            return pluginState;
          }

          // let codeBlockChanged = false;

          // // Compare changed ranges only
          // tr.mapping.maps.forEach((stepMap) => {
          //   stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
          //     oldState.doc.nodesBetween(oldStart, oldEnd, (node) => {
          //       if (node.type.name === 'code_block') {
          //         codeBlockChanged = true;
          //       }
          //     });

          //     newState.doc.nodesBetween(newStart, newEnd, (node) => {
          //       if (node.type.name === 'code_block') {
          //         codeBlockChanged = true;
          //       }
          //     });
          //   });
          // });

          // if (codeBlockChanged) {
          //   console.log("Code block changed");
          //   // trigger your logic here
          // }

          return pluginState;
        },
      },
      props: {
        decorations(state) {
          const pluginState = DiagnosticsPluginKey.getState(state);
          if (!pluginState) return DecorationSet.empty;

          const decorations: Decoration[] = [];

          for (const uri in pluginState.uriToDiagnostics) {
            const diagnostics = uri && pluginState.uriToDiagnostics[uri];
            if (!diagnostics || diagnostics.version !== editor.version) {
              continue;
            }

            for (const diag of diagnostics.diagnostics) {
              const attrs: Record<string, any> = {
                ...diag.attrs,
                class: undefined,
              };
              const cls = diag.attrs?.class || '';
              let style = diag.attrs?.style || '';

              if (attrs['data-anchor']) {
                // TODO make it dynamic CSS class when available (see ui.css)
                style += ' ; anchor-name: ' + attrs['data-anchor'];
              }

              decorations.push(
                Decoration.inline(diag.range.from, diag.range.to, {
                  ...attrs,
                  class: 'kb-lsp__error ' + cls,
                  style: style || undefined,
                  'data-message': diag.message,
                }),
              );
            }
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    });
  }
}
