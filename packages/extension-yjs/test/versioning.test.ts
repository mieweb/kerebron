import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { createTestServer, shutdownServer } from './utils/createTestServer.ts';

function createNewDocEditor(port: number, user = 'test-user') {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
      YjsEditorKit.createFrom('ws://localhost:' + port + '/yjs'),
    ],
  });

  return { editor };
}

const STEP_TS = 50;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.test('testVersioning', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testVersioning').run();
    editor.chain().changeUser({ id: 'me' }).run();
    await sleep(0);

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );

      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

      const p = new Y.XmlElement('paragraph');
      const ytext = new Y.XmlText('hello world!');

      p.insert(0, [ytext]);
      yxml.insert(0, [p]);

      const prevSnapshot = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      ytext.delete(0, 6);

      const snapshot = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      editor.chain().setYSnapshot({ prevSnapshot, snapshot }).run();
      await sleep(STEP_TS);

      console.log(
        'calculated diff via snapshots: ',
        JSON.stringify(editor.state.doc.toJSON(), null, 2),
      );
      // recreate the JSON, because ProseMirror messes with the constructors
      const viewstate1 = JSON.parse(
        JSON.stringify(editor.state.doc.toJSON().content[0].content),
      );
      const expectedState = [{
        type: 'text',
        marks: [{ type: 'ychange', attrs: { user: 'me', type: 'removed' } }],
        text: 'hello ',
      }, {
        type: 'text',
        text: 'world!',
      }];
      console.log(
        'calculated diff via snapshots: ',
        JSON.stringify(viewstate1, null, 2),
      );
      assertEquals(viewstate1, expectedState);

      console.info(
        'now check whether we get the same result when rendering the updates',
      );
      editor.chain().setYSnapshot({ prevSnapshot, snapshot }).run();
      await sleep(STEP_TS);

      const viewstate2 = JSON.parse(
        JSON.stringify(editor.state.doc.toJSON().content[0].content),
      );
      console.log('calculated diff via updates: ', JSON.stringify(viewstate2));
      assertEquals(viewstate2, expectedState);
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('testVersioningWithGarbageCollection', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testVersioningWithGarbageCollection').run();
    editor.chain().changeUser({ id: 'me' }).run();
    await sleep(0);

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );

      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

      const p = new Y.XmlElement('paragraph');
      const ytext = new Y.XmlText('hello world!');
      p.insert(0, [ytext]);
      yxml.insert(0, [p]);

      const snapshotDoc1 = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      ytext.delete(0, 6);

      const snapshotDoc2 = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      editor.chain().setYSnapshot({
        prevSnapshot: snapshotDoc1,
        snapshot: snapshotDoc2,
      }).run();
      await sleep(STEP_TS);

      console.log(
        'calculated diff via snapshots: ',
        JSON.stringify(editor.state.doc.toJSON(), null, 2),
      );
      // recreate the JSON, because ProseMirror messes with the constructors
      const viewstate1 = JSON.parse(
        JSON.stringify(editor.state.doc.toJSON().content[0].content),
      );
      const expectedState = [{
        type: 'text',
        marks: [{ type: 'ychange', attrs: { user: 'me', type: 'removed' } }],
        text: 'hello ',
      }, {
        type: 'text',
        text: 'world!',
      }];
      console.log(
        'calculated diff via snapshots: ',
        JSON.stringify(viewstate1, null, 2),
      );
      assertEquals(viewstate1, expectedState);
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});
