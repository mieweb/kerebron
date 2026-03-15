import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionSelection } from '@kerebron/extension-basic-editor/ExtensionSelection';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { WebsocketProvider } from '@kerebron/extension-yjs/WebsocketProvider';
import { userColors } from '@kerebron/extension-yjs/userColors';

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

let userName = '';
if (!userName) {
  userName = 'TODO ' + Math.floor(Math.random() * 100);
}

const editor = CoreEditor.create({
  editorKits: [
    new BrowserLessEditorKit(),
    YjsEditorKit.createFrom(userName),
  ],
});

let cursorPlugin;
cursorPlugin = editor.state.plugins.find((plugin) =>
  plugin.key === 'yjs-position$'
);

wsProvider.addEventListener('status', (event) => {
  console.log('wsProvider status', event.detail.status); // logs "connected" or "disconnected"

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

  const editor2 = CoreEditor.create({
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  editor2.setDocument(slice);

  const buffer = await editor2.saveDocument('text/x-markdown');
  const md = new TextDecoder().decode(buffer);
  console.log('md', md);
});
