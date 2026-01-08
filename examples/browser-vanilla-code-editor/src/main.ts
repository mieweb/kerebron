import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { CodeEditorKit } from '@kerebron/editor-kits/CodeEditorKit';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import type { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import type { LspTransportGetter, Transport } from '@kerebron/extension-lsp';
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';

window.addEventListener('load', async () => {
  const docUrl = globalThis.location.hash.slice(1);
  let roomId;
  if (docUrl.startsWith('room:')) {
    roomId = docUrl.substring('room:'.length);
  } else {
    roomId = String(Math.random());
    globalThis.location.hash = 'room:' + roomId;
  }
  const ydoc = new Y.Doc();

  const getLspTransport: LspTransportGetter = (
    lang: string,
  ): Transport | undefined => {
    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const uri = protocol + '//' + globalThis.location.host + '/lsp';

    switch (lang) {
      case 'markdown':
        return new LspWebSocketTransport(uri + '/mine');
      case 'json':
        return new LspWebSocketTransport(uri + '/deno');
      case 'typescript':
      case 'javascript':
        return new LspWebSocketTransport(uri + '/typescript');
      case 'yaml':
        return new LspWebSocketTransport(uri + '/yaml');
    }
    return undefined;
  };

  const editor = CoreEditor.create({
    uri: 'test.yaml',
    topNode: 'doc_code',
    element: document.getElementById('editor') || undefined,
    editorKits: [
      new CodeEditorKit('json'),
      YjsEditorKit.createFrom(ydoc, roomId),
      LspEditorKit.createFrom({ getLspTransport }),
      // lsp-ws-proxy --listen 9991 -- npx yaml-language-server --stdio
      // lsp-ws-proxy --listen 9991 -- npx vscode-json-languageserver --stdio
      // ... https://www.npmjs.com/search?q=language-server
      // ... https://www.npmjs.com/search?q=keywords:LSP
    ],
  });

  editor.addEventListener('selection', (event: CustomEvent) => {
    const selection = event.detail.selection;
    const extensionMarkdown: ExtensionBasicCodeEditor | undefined = editor
      .getExtension('basic-code-editor');
    if (extensionMarkdown) {
      const result = extensionMarkdown.toRawText(editor.state.doc);
      const code = result.content;

      const mapper = new PositionMapper(editor, result.rawTextMap);
      const from = mapper.toRawTextPos(selection.from);
      const to = mapper.toRawTextPos(selection.to);

      if (from > -1 && to > -1) {
        const parts = [
          code.substring(0, from),
          code.substring(from, to),
          code.substring(to),
        ];
        const preHtml = '<span>' + parts[0] + '</span>' +
          '<span class="md-selected">' + parts[1] + '</span>' +
          '<span>' + parts[2] + '</span>';

        document.getElementById('markdown').innerHTML = preHtml;
      } else {
        return code;
      }
    }
  });

  editor.addEventListener('transaction', async (ev: CustomEvent) => {
    // console.trace();
    return;
    const lastValue = ev.detail.transaction.doc;
    const buffer = await editor.saveDocument('text/code-only');
    console.log('buffer', buffer);
    const code = new TextDecoder().decode(buffer);
    // this.$emit('input', this.lastValue);
  });

  document.getElementById('loadDoc')?.addEventListener('click', async () => {
    const buffer = new TextEncoder().encode(
      '# Multiline string with literal block syntax -preserved new lines\n' +
        'string1: |\n' +
        '   Line1\n' +
        '   line2\n' +
        '   "line3"\n' +
        '  line4\n',
    );
    await editor.loadDocument('text/code-only', buffer);
  });
});
