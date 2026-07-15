import { Plugin } from 'prosemirror-state';
import * as lsp from 'vscode-languageserver-protocol';

import { Extension, TextRange } from '@kerebron/editor';
import type {
  HoverMatch,
  HoverSource,
  HoverTrigger,
} from '@kerebron/extension-ui/hover';

import { Transport } from './LSPClient.ts';
import { LSPPlugin, LSPPluginKey } from './LSPPlugin.ts';

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
    // const { autocompleteConfig } = createLspAutocomplete(this);
    plugins.push(new LSPPlugin(this.config, this.editor));
    return plugins;
  }

  override created(): void {
    const source3: HoverSource = {
      match: function (trigger: HoverTrigger): HoverMatch | undefined {
        let pos = trigger.pos;
        if (trigger.uri) {
          pos = pos + trigger.inside;
        }

        return {
          source: source3,
          uri: trigger.uri,
          range: {
            from: pos,
            to: pos,
          },
          trigger,
          text: '...',
        };
      },
      getItem: async (range: TextRange, trigger: HoverTrigger) => {
        if (!trigger.uri) {
          return;
        }

        const lspSync = LSPPluginKey.getState(this.editor.state);
        if (!lspSync) {
          return;
        }

        const lspClient = lspSync.uriToClient[trigger.uri];
        const entry = lspClient.getEntry(trigger.uri);
        if (!entry) {
          return;
        }

        const contentMapper = await entry.getContentMapper();
        const [line, character] = contentMapper.toRawTextLineCol(
          trigger.inside,
        );

        const hover = await lspClient.request<
          lsp.HoverParams,
          lsp.Hover | null
        >(
          'textDocument/hover',
          {
            textDocument: {
              uri: trigger.uri,
            },
            position: {
              line,
              character,
            },
          },
        );

        if (!hover) {
          return;
        }

        const contents = hover.contents;
        if (Array.isArray(contents)) {
          return { text: contents.map((a) => a.toString).join('\n') };
        }

        if ('string' === typeof contents) {
          return { text: contents };
        }

        if ('kind' in contents) {
          return { text: contents.value };
        }

        return { text: contents.value, a: contents.language };
      },
    };

    this.editor.addEventListener('ready', () => {
      this.editor.chain().addHoverSource(source3).run();
    }, { once: true });
  }
}
