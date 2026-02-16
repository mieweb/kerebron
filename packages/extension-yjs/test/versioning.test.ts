import * as Y from 'yjs';

import * as promise from 'lib0/promise';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey } from '../src/keys.ts';
import { YSyncPluginState } from '../src/ySyncPlugin.ts';
import { debugYDoc, debugYDocSnapshot, debugYNode } from '../src/debug.ts';

function createNewProsemirrorView() {
  const editor = CoreEditor.create({
    editorKits: [
      new BrowserLessEditorKit(),
      YjsEditorKit.createFrom('test-user', 'ws://localhost:12345'),
    ],
  });

  const pluginState: YSyncPluginState = ySyncPluginKey.getState(
    editor.state,
  )!;

  const ydoc = pluginState.ydoc;
  const schema = editor.schema;
  const view = editor.view;
  return { ydoc, schema, view };
}

Deno.test('testVersioning', async () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  ydoc.gc = false;
  // const ydoc = new Y.Doc({ gc: false });
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  const permanentUserData = new Y.PermanentUserData(ydoc);
  permanentUserData.setUserMapping(ydoc, ydoc.clientID, 'me');
  ydoc.gc = false;

  const p = new Y.XmlElement('paragraph');
  const ytext = new Y.XmlText('hello world!');

  p.insert(0, [ytext]);
  yxml.insert(0, [p]);
  const prevSnapshot = Y.snapshot(ydoc);
  const prevDoc: Uint8Array = Y.encodeStateAsUpdateV2(ydoc);

  ytext.delete(0, 6);
  const snapshot = Y.snapshot(ydoc);
  const currentDoc: Uint8Array = Y.encodeStateAsUpdateV2(ydoc);

  view.dispatch(
    view.state.tr.setMeta(ySyncPluginKey, {
      snapshot: snapshot,
      prevSnapshot: prevSnapshot,
      permanentUserData,
    }),
  );

  await promise.wait(50);
  console.log(
    'calculated diff via snapshots: ',
    JSON.stringify(view.state.doc.toJSON(), null, 2),
  );
  // recreate the JSON, because ProseMirror messes with the constructors
  const viewstate1 = JSON.parse(
    JSON.stringify(view.state.doc.toJSON().content[0].content),
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
  view.dispatch(
    view.state.tr.setMeta(ySyncPluginKey, {
      snapshot: currentDoc,
      prevSnapshot: prevDoc,
      permanentUserData,
    }),
  );
  await promise.wait(50);

  const viewstate2 = JSON.parse(
    JSON.stringify(view.state.doc.toJSON().content[0].content),
  );
  console.log('calculated diff via updates: ', JSON.stringify(viewstate2));
  assertEquals(viewstate2, expectedState);
});

Deno.test('testVersioningWithGarbageCollection', async () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  const permanentUserData = new Y.PermanentUserData(ydoc);
  permanentUserData.setUserMapping(ydoc, ydoc.clientID, 'me');

  const p = new Y.XmlElement('paragraph');
  const ytext = new Y.XmlText('hello world!');
  p.insert(0, [ytext]);
  yxml.insert(0, [p]);
  const snapshotDoc1 = Y.encodeStateAsUpdateV2(ydoc);
  ytext.delete(0, 6);
  const snapshotDoc2 = Y.encodeStateAsUpdateV2(ydoc);
  view.dispatch(
    view.state.tr.setMeta(ySyncPluginKey, {
      snapshot: snapshotDoc2,
      prevSnapshot: snapshotDoc1,
      permanentUserData,
    }),
  );
  await promise.wait(50);
  console.log(
    'calculated diff via snapshots: ',
    JSON.stringify(view.state.doc.toJSON(), null, 2),
  );
  // recreate the JSON, because ProseMirror messes with the constructors
  const viewstate1 = JSON.parse(
    JSON.stringify(view.state.doc.toJSON().content[0].content),
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
});
