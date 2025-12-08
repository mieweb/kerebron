import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';
import { dracula } from 'thememirror';
import { WebsocketProvider } from 'y-websocket';

import { userColors } from '@kerebron/extension-yjs/userColors';
import * as Y from 'yjs';
import { ExtensionSelection } from '@kerebron/extension-basic-editor/ExtensionSelection';

const ydoc = new Y.Doc();

const roomId = 'aaa';
const userColor = userColors[1 % userColors.length];

const wsProvider = new WebsocketProvider(
  'http://localhost:8000/yjs',
  roomId,
  ydoc,
);

wsProvider.awareness.setLocalStateField('user', {
  name: 'BOT ' + Math.floor(Math.random() * 100),
  color: userColor.color,
  colorLight: userColor.light,
});

const editor = new CoreEditor({
  extensions: [
    new ExtensionBasicEditor(),
    new ExtensionMarkdown(),
    new ExtensionTables(),
    new ExtensionYjs({ ydoc, provider: wsProvider }),
    new ExtensionCodeMirror({ theme: [dracula] }),
  ],
});

let cursorPlugin;
cursorPlugin = editor.state.plugins.find((plugin) =>
  plugin.key === 'yjs-position$'
);

wsProvider.on('status', (event) => {
  console.log('wsProvider status', event.status); // logs "connected" or "disconnected"

  if (event.status === 'connected') {
    // console.log(selectionExtension.extractSelection());
  }
});

const extensionSelection = <ExtensionSelection> editor.getExtension(
  'selection',
);

ydoc.on('update', async () => {
  console.log('doc update');
  if (!extensionSelection) {
    return;
  }
  editor.chain().selectAll().run();
  if (cursorPlugin) {
    cursorPlugin.updateCursorInfo(editor.state);
  }
  const slice = extensionSelection.extractSelection();

  const editor2 = new CoreEditor({
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionTables(),
      new ExtensionCodeMirror(),
    ],
  });

  editor2.setDocument(slice);

  const buffer = await editor2.saveDocument('text/x-markdown');
  const md = new TextDecoder().decode(buffer);
  console.log('md', md);
});
