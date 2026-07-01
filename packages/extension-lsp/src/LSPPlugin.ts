import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Diagnostic } from 'vscode-languageserver-protocol';

import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { CoreEditor } from '@kerebron/editor';
import {
  type ExtensionMarkdown,
  type MarkdownResult,
} from '@kerebron/extension-markdown';

import { ExtensionLsp, LspConfig } from './ExtensionLsp.ts';

export interface LspRange {
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

interface LSPMeta {
}

interface WorkspaceMetaOpen {
  operation: 'openFile';
  uri: string;
  lang: string;
}

interface WorkspaceMetaModify {
  operation: 'modifyFile';
  uri: string;
}

interface WorkspaceMetaClose {
  operation: 'closeFile';
  uri: string;
}

type WorkspaceMeta =
  | WorkspaceMetaOpen
  | WorkspaceMetaClose
  | WorkspaceMetaModify;

class LSPPluginState {
  diagnostics: DiagnosticsItem[] = [];

  snapshot?: {
    version: number;
    mapper: PositionMapper;
    markdownResult: MarkdownResult;
  };

  constructor(private editor: CoreEditor) {
  }
}

const LSPPluginKey = new PluginKey('lsp');

export class LSPPlugin extends Plugin<LSPPluginState> {
  listenerDiag: ((event: Event) => void) | undefined;
  listenerDisconnect: ((event: Event) => void) | undefined;
  listenerChange: ((event: Event) => void) | undefined;

  constructor(config: LspConfig, extension: ExtensionLsp) {
    super({
      key: LSPPluginKey,
      view(view) {
        return {
          destroy: () => {
            const client = extension.getClient(extension.mainLang);

            if (this.listenerDiag && client) {
              client.removeEventListener(
                'textDocument/publishDiagnostics',
                this.listenerDiag,
              );
            }
            if (this.listenerDisconnect && client) {
              client.removeEventListener(
                'close',
                this.listenerDisconnect,
              );
            }
            // if (this.listenerChange) {
            //   extension.getEditor().removeEventListener(
            //     'change',
            //     this.listenerChange,
            //   );
            // }
          },
        };
      },
      state: {
        init() {
          return new LSPPluginState(editor);
        },
        apply(
          tr: Transaction,
          value: LSPPluginState,
          oldState,
          newState,
        ) {
          const workspaceMeta: WorkspaceMeta | undefined = tr.getMeta(
            'workspace',
          );

          if (workspaceMeta) {
            console.log(
              'workspaceMeta',
              workspaceMeta.operation,
              workspaceMeta,
            );

            const uri = workspaceMeta.uri;
            // const lang = workspaceMeta.lang;

            switch (workspaceMeta.operation) {
              case 'openFile':
                {
                  const client = extension.getClient(workspaceMeta.lang);
                  if (client) {
                    client.addEventListener(
                      'textDocument/publishDiagnostics',
                      this.diagListener,
                    );

                    const go = async () => {
                      client.connect(uri, this.source);
                      if (uri === editor.config.uri) {
                        await client.restart();
                      }
                      client.workspace.openFile(
                        workspaceMeta.uri,
                        workspaceMeta.lang,
                        this.source,
                      );
                    };

                    go();
                  }
                }
                break;
              case 'modifyFile':
                break;
              case 'closeFile':
                // this.editor.view.dispatch(tr);
                // const client = this.getClient(this.mainLang);
                // if (client) {
                //   client.disconnect(this.uri);
                // }

                break;
            }

            return value;
          }

          const meta: LSPMeta | undefined = tr.getMeta(LSPPluginKey);
          if (meta?.diagnostics) {
            value.diagnostics = meta.diagnostics;
          }

          const markdownMeta = tr.getMeta('markdown');
          if (markdownMeta?.snapshot) {
            value.snapshot = markdownMeta.snapshot;
            return value;
          }
          if (markdownMeta?.clearSnapshot) {
            value.snapshot = undefined;
            return value;
          }

          if (tr.docChanged) {
            // value.snapshot = undefined;
          }

          // let codeBlockChanged = false;

          // // Compare changed ranges only
          // tr.mapping.maps.forEach((stepMap) => {
          //   stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
          //     oldState.doc.nodesBetween(oldStart, oldEnd, (node) => {
          //       if (node.type.name === "code_block") {
          //         codeBlockChanged = true;
          //       }
          //     });

          //     newState.doc.nodesBetween(newStart, newEnd, (node) => {
          //       if (node.type.name === "code_block") {
          //         codeBlockChanged = true;
          //       }
          //     });
          //   });
          // });

          // if (codeBlockChanged) {
          //   console.log("Code block changed");
          //   // trigger your logic here
          // }

          return value;
        },
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          const pluginState = this.getState(state);
          if (pluginState) {
            const { diagnostics, snapshot } = pluginState;

            if (snapshot?.version === editor.version) {
              for (const diag of diagnostics) {
                const from = snapshot.mapper.fromLineChar(
                  diag.range.start.line,
                  diag.range.start.character,
                );
                const end = snapshot.mapper.fromLineChar(
                  diag.range.end.line,
                  diag.range.end.character,
                );

                if (from > -1 && end > -1) {
                  const decoration = Decoration.inline(
                    from,
                    end,
                    { class: 'kb-lsp__error', title: diag.message },
                  );
                  decorations.push(decoration);
                }
              }
            }
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    });

    let lastDiag = 0;

    const editor = extension.getEditor();

    const uri = editor.config.uri;
    if (uri) {
      const client = extension.getClient(extension.mainLang);

      this.listenerDiag = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.params.uri !== uri) {
          return;
        }

        event.preventDefault();

        lastDiag = +Date();

        if (client) {
          const file = client.workspace.getFile(uri);
          if (file) {
            const { mapper } = file;

            const diagnostics: Array<Diagnostic> = detail.params.diagnostics;

            // file.dia

            const tr = editor.view.state.tr.setMeta(LSPPluginKey, {
              diagnostics: detail.params.diagnostics,
              mapper,
            });
            editor.view.dispatch(tr);
          }
        }
      };

      if (client) {
        client.addEventListener(
          'textDocument/publishDiagnostics',
          this.listenerDiag,
        );
      }

      this.listenerDisconnect = (event: Event) => {
        const tr = editor.view.state.tr.setMeta(LSPPluginKey, {
          diagnostics: [],
          mapper: undefined,
        });
        editor.view.dispatch(tr);
      };

      if (client) {
        client.addEventListener(
          'close',
          this.listenerDisconnect,
        );
      }

      this.listenerChange = (event: Event) => {
        if (lastDiag === 0 && +Date() - lastDiag > 10_1000) {
          return;
        }
        const tr = editor.view.state.tr.setMeta(LSPPluginKey, {
          diagnostics: [],
          mapper: undefined,
        });
        editor.view.dispatch(tr);
      };

      // extension.getEditor().addEventListener('changed', this.listenerChange);
    }
  }
}
