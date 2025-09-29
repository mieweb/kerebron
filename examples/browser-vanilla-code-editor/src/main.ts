import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from './y-websocket.ts';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';

import {
  NodeCodeMirror,
  NodeDocumentCode,
} from '@kerebron/extension-codemirror';
import { userColors } from '@kerebron/extension-yjs/userColors';

window.addEventListener('load', () => {
  const docUrl = globalThis.location.hash.slice(1);
  let roomId;
  if (docUrl.startsWith('room:')) {
    roomId = docUrl.substring('room:'.length);
  } else {
    roomId = String(Math.random());
    globalThis.location.hash = 'room:' + roomId;
  }
  const ydoc = new Y.Doc();

  const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
  const wsProvider = new WebsocketProvider(
    protocol + '//' + globalThis.location.host + '/yjs',
    roomId,
    ydoc,
  );
  console.log('roomId', roomId);
  wsProvider.on('status', (event) => {
    console.log('wsProvider status', event.status); // logs "connected" or "disconnected"
  });

  const userColor = userColors[random.uint32() % userColors.length];
  wsProvider.awareness.setLocalStateField('user', {
    name: 'Anonymous ' + Math.floor(Math.random() * 100),
    color: userColor.color,
    colorLight: userColor.light,
  });

  const editor = new CoreEditor({
    topNode: 'doc_code',
    element: document.getElementById('editor') || undefined,
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new NodeDocumentCode({ lang: 'yaml' }),
      new ExtensionYjs({ ydoc, provider: wsProvider }),
      new ExtensionDevToolkit(),
      new NodeCodeMirror({
        ydoc,
        provider: wsProvider,
        languageWhitelist: ['yaml'],
        readOnly: false,
      }),
    ],
    // content: pmDoc
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
