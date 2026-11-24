import * as lsp from 'vscode-languageserver-protocol';

import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import type { HoverMatch, HoverSource, HoverTrigger } from '@kerebron/ui/hover';
import {
  AutocompleteSource,
  createPosMatcher,
} from '@kerebron/ui/autocomplete';
import { bindSelect } from '@kerebron/ui/events';
import { Ui } from '@kerebron/ui';
import { TemplatesRegistry } from '@kerebron/ui/templates';

import { Transport } from './LSPClient.ts';
import { LSPPlugin, LSPPluginKey } from './LSPPlugin.ts';
import { expandLspSnippet, itemTextEditRange } from './snippets.ts';

export type LSPTransportGetter = (lang: string) => Transport | undefined;

export interface LspConfig {
  getLspTransport: LSPTransportGetter;
}

export class ExtensionLsp extends Extension {
  name = 'lsp';

  constructor(public override config: LspConfig) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    const plugins: Plugin[] = [];
    plugins.push(new LSPPlugin(this.config, this.editor));
    return plugins;
  }

  override created(): void {
    this.editor.addEventListener('ready', () => {
      const lspSync = LSPPluginKey.getState(this.editor.state);
      if (lspSync) {
        lspSync.addEventListener('createClient', (event) => {
          //           const client: LSPClient = (event as CustomEvent).detail;
          //           client.addEventListener('initialized', (event) => {
          //           });
        });
      }

      this.editor.run.addDiagnosticHover();

      const ui: Ui = this.editor.di.resolve('ui');

      const hoverSource: HoverSource = {
        match: function (trigger: HoverTrigger): HoverMatch | undefined {
          if (trigger.mode !== 'mouse') {
            return;
          }

          if (!trigger.uri) {
            return;
          }

          const pos = trigger.pos;

          return {
            range: {
              from: pos,
              to: pos,
            },
            text: '',
            meta: JSON.stringify(trigger),
          };
        },
        processRequest: async (
          trigger,
          match,
          createPopup,
        ) => {
          if (!trigger.uri) {
            return;
          }
          const lspSync = LSPPluginKey.getState(this.editor.state);
          if (!lspSync) {
            return;
          }
          const lspClient = lspSync.uriToClient[trigger.uri];
          if (!lspClient) {
            return;
          }

          const entry = lspClient.getEntry(trigger.uri);
          if (!entry) {
            return;
          }

          const contentMapper = await entry.getContentMapper();

          const pos = contentMapper.toRawTextLineCol(trigger.textOffset);
          const lspPos: lsp.Position = {
            line: pos[0],
            character: pos[1],
          };

          const hover = await lspClient.request<
            lsp.HoverParams,
            lsp.Hover | null
          >(
            'textDocument/hover',
            {
              textDocument: {
                uri: trigger.uri,
              },
              position: lspPos,
            },
          );

          if (!hover) {
            return;
          }

          let from = hover.range
            ? contentMapper.fromLineChar(
              hover.range.start.line,
              hover.range.start.character,
            )
            : -1;
          let to = hover.range
            ? contentMapper.fromLineChar(
              hover.range.end.line,
              hover.range.end.character,
            )
            : -1;

          if (from > -1) {
            from += trigger.pos;
          }
          if (to > -1) {
            to += trigger.pos;
          }

          const contents = hover.contents;

          let value;
          if (Array.isArray(contents)) {
            value = {
              text: contents.map((a) => a.toString).join('\n\n'),
              kind: 'plaintext',
              from,
              to,
            };
          } else if ('string' === typeof contents) {
            value = { text: contents, from, to, kind: 'plaintext' };
          } else {
            if ('kind' in contents) {
              value = { text: contents.value, from, to, kind: contents.kind };
            } else {
              value = {
                text: contents.value,
                from,
                to,
                kind: contents.language,
              };
            }
          }

          const text = 'source3.getItem ' + match.meta + ', mode: ' +
            trigger.mode;

          const popup = createPopup();
          switch (value.kind) {
            case 'markdown':
              ui.setPopupContent(popup, ['markdown', value.text]);
              break;
            default:
              ui.setPopupContent(popup, ['pre', value.text]);
              break;
          }

          return {
            ...match,
            range: { from: value.from, to: value.to },
            meta: text,
          };
        },
      };

      this.editor.chain().addHoverSource(hoverSource).run();

      const autocompleteSource: AutocompleteSource = {
        triggerKeys: ['ctrl- '],
        match: createPosMatcher(),
        processRequest: async (trigger, match, createPopup) => {
          if (!trigger.uri) {
            return;
          }
          const lspSync = LSPPluginKey.getState(this.editor.state);
          if (!lspSync) {
            return;
          }
          const lspClient = lspSync.uriToClient[trigger.uri];
          if (!lspClient) {
            return;
          }

          const entry = lspClient.getEntry(trigger.uri);
          if (!entry) {
            return;
          }

          const contentMapper = await entry.getContentMapper();

          const pos = contentMapper.toRawTextLineCol(trigger.textOffset);
          const lspPos: lsp.Position = {
            line: pos[0],
            character: pos[1],
          };

          const response = await lspClient.request<
            lsp.CompletionParams,
            lsp.CompletionList | lsp.CompletionItem[] | null
          >(
            'textDocument/completion',
            {
              textDocument: { uri: trigger.uri },
              position: lspPos,
              context: trigger.mode === 'auto'
                ? {
                  triggerKind: lsp.CompletionTriggerKind.TriggerCharacter,
                  triggerCharacter: match.text,
                }
                : {
                  triggerKind: lsp.CompletionTriggerKind.Invoked,
                },
            },
          );

          if (!response) {
            return;
          }

          const items = Array.isArray(response) ? response : response.items;
          if (items.length === 0) {
            return;
          }
          const itemDefaults = Array.isArray(response)
            ? undefined
            : response.itemDefaults;

          const templates: TemplatesRegistry = this.editor.di.resolve(
            'templates',
          );

          const popup = createPopup();
          const shownItems = items.slice(0, 15);
          ui.setPopupContent(
            popup,
            templates['dropdown-list']({
              items: shownItems
                .map((i) => ({
                  label: i.label,
                  value: i.label,
                })),
            }),
          );
          bindSelect(popup, (_value, idx) => {
            const item = shownItems[idx];
            if (!item) {
              return;
            }

            const insertText = item.textEdit?.newText ??
              (itemDefaults?.editRange
                ? item.textEditText ?? item.label
                : item.insertText ?? item.label);
            const text = expandLspSnippet(
              insertText,
              item.insertTextFormat ?? itemDefaults?.insertTextFormat,
            );

            const editRange = itemTextEditRange(item, itemDefaults);
            let range = match.range;
            if (editRange) {
              const base = trigger.pos - trigger.textOffset;
              const from = contentMapper.fromLineChar(
                editRange.start.line,
                editRange.start.character,
              );
              const to = contentMapper.fromLineChar(
                editRange.end.line,
                editRange.end.character,
              );
              if (base >= 0 && from > -1 && to > -1) {
                range = { from: base + from, to: base + to };
              }
            }

            this.editor.chain().replaceRangeText(range, text).run();
          });

          return {
            ...match,
            meta: items,
          };
        },
      };

      this.editor.chain().addAutocompleteSource(autocompleteSource).run();
    }, { once: true });
  }
}
