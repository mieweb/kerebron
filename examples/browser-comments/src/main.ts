import { CoreEditor } from '@kerebron/editor';
import { YjsEditorKit } from '@kerebron/yjs/YjsEditorKit';
import { AdvancedEditorKit } from '@kerebron/editor-kits//AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import { initSnapshots } from './initSnapshots.ts';
import { initComments } from './intiComments.ts';

const editor = CoreEditor.create({
  uri: 'test.md',
  element: document.getElementById('editor') || undefined,
  assetLoad: createAssetLoad('/wasm'),
  editorKits: [
    new AdvancedEditorKit(),
    YjsEditorKit.createFrom({ addMenu: true }),
  ],
});

initSnapshots(editor);
initComments(editor);

window.addEventListener('load', async () => {
  document.getElementById('resetYSnapshot')!.style.display = 'none';

  const docUrl = globalThis.location.hash.slice(1);
  let roomId;
  if (docUrl.startsWith('room:')) {
    roomId = docUrl.substring('room:'.length);
  } else {
    roomId = String(Math.random());
    globalThis.location.hash = 'room:' + roomId;
  }

  let user;

  if (roomId) {
    editor.chain().changeRoom(roomId).run();
  }
  if (user) {
    editor.chain().changeUser(user).run();
  }
});
