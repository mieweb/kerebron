import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';
import { dracula } from 'thememirror';
import { WebsocketProvider } from 'y-websocket';

import { userColors } from '@kerebron/extension-yjs/userColors';
import * as Y from 'yjs';
import { SelectionExtension } from './SelectionExtension.ts';

const ydoc = new Y.Doc();

const roomId = 'aaa';
const userColor = userColors[1 % userColors.length];

const wsProvider = new WebsocketProvider(
  'http://localhost:8000/yjs',
  roomId,
  ydoc,
);

const selectionExtension = new SelectionExtension();

wsProvider.awareness.setLocalStateField('user', {
  name: 'BOT ' + Math.floor(Math.random() * 100),
  color: userColor.color,
  colorLight: userColor.light,
});

const editor = new CoreEditor({
  extensions: [
    selectionExtension,
    new ExtensionBasicEditor(),
    new ExtensionMarkdown(),
    new ExtensionTables(),
    new ExtensionYjs({ ydoc, provider: wsProvider }),
    new NodeCodeMirror({ theme: [dracula], ydoc, provider: wsProvider }),
    // new NodeCodeMirror({ theme: [dracula] }),
    // new NodeCodeMirror(),
  ],
});

let cursorPlugin;
cursorPlugin = editor.state.plugins.find((plugin) =>
  plugin.key === 'yjs-cursor$'
);

wsProvider.on('status', (event) => {
  console.log('wsProvider status', event.status); // logs "connected" or "disconnected"

  if (event.status === 'connected') {
    // console.log(selectionExtension.extractSelection());
  }
});

ydoc.on('update', () => {
  console.log('doc update');
  selectionExtension.selectAll();
  if (cursorPlugin) {
    cursorPlugin.updateCursorInfo(editor.state);
  }
  const slice = selectionExtension.extractSelection();

  const editor2 = new CoreEditor({
    content: slice,
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionTables(),
      new NodeCodeMirror(),
    ],
  });

  const md = editor2.getDocument('text/x-markdown');
  console.log('md', md);
});
