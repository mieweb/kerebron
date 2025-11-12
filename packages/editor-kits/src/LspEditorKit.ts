import { CoreEditor, Extension } from '@kerebron/editor';
import type { AnyExtensionOrReq, TextRange } from '@kerebron/editor';
import {
  createRegexMatcher,
  ExtensionAutocomplete,
} from '@kerebron/extension-autocomplete';

import { simpleLspWebSocketTransport } from '@kerebron/extension-lsp/simpleLspWebSocketTransport';
import { ExtensionLsp } from '@kerebron/extension-lsp';

import type { Token } from '@kerebron/extension-markdown';
import { SmartOutput } from '@kerebron/editor/utilities';
import { Transport } from '@kerebron/extension-lsp';

export class LspEditorKit extends Extension {
  override name = 'lsp-kit';
  requires: AnyExtensionOrReq[];

  md: string = '';

  static async createFrom(config?: ConstructorParameters<typeof Extension>[0]) {
    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const lspTransport = await simpleLspWebSocketTransport(
      protocol + '//' + globalThis.location.host + '/lsp',
    );

    return new LspEditorKit(config, lspTransport);
  }

  constructor(
    config?: ConstructorParameters<typeof Extension>[0],
    lspTransport: Transport,
  ) {
    super(config);

    this.requires = [
      new ExtensionLsp({ lspTransport }),
    ];
  }

  override created() {
    this.editor.addEventListener('selection', async (ev: CustomEvent) => {
      const selection = ev.detail.selection;
      if (selection) {
        const from = Math.min(selection.$anchor.pos, selection.$head.pos);
        const to = Math.max(selection.$anchor.pos, selection.$head.pos);
        // console.log('lsp.sel', from, to);
      }
    });

    this.editor.addEventListener(
      'transaction',
      async (ev: CustomEvent<any>) => {
        // this.lastValue = ev.detail.transaction.doc;
        const buffer = await this.editor.saveDocument('text/x-markdown');
        this.md = new TextDecoder().decode(buffer);
        // this.$emit('input', this.lastValue);
      },
    );

    this.editor.addEventListener('md:output', async (ev: CustomEvent<any>) => {
      const output: SmartOutput<Token> = ev.detail.output;
      const mapping = output
        .getMetas()
        .filter((meta) =>
          +(meta?.item?.map?.length) > 0 && meta?.item?.type === 'text'
        )
        .map((meta) => ({
          pmPos: meta.item?.map?.[0] || -1,
          mdPos: meta.pos,
          item: meta.item,
        }));
    });
  }
}
