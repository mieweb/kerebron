import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { assert, assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

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

Deno.test('snapshot_diff_renders_previous_vs_current', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor } = createNewDocEditor(port, 'snapshot-user');
    editor.chain().changeRoom('room-snapshot-diff').run();
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

      ytext.delete(0, 6); // remove "hello "
      await sleep(STEP_TS);

      const snapshot = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      editor.chain().setYSnapshot({ prevSnapshot, snapshot }).run();
      await sleep(STEP_TS);
    }

    // In diff view we expect "hello world!" visible (with ychange mark on removed part)
    assertEquals(editor.state.doc.textContent, 'hello world!');

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('snapshot_mode_blocks_pm_to_yjs_live_sync', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: editor1 } = createNewDocEditor(port, 'user-a');
    const { editor: editor2 } = createNewDocEditor(port, 'user-b');

    editor1.chain().changeRoom('room-snapshot-blocks-sync').run();
    editor2.chain().changeRoom('room-snapshot-blocks-sync').run();

    await sleep(STEP_TS);

    {
      const ydoc1: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml1: Y.XmlFragment = ydoc1.get('kerebron:doc', Y.XmlFragment);
      const p = new Y.XmlElement('paragraph');
      const ytext = new Y.XmlText('alpha beta');
      p.insert(0, [ytext]);
      yxml1.insert(0, [p]);

      const prevSnapshot = await new Promise((resolve, reject) =>
        editor1.chain().getYSnapshot({ resolve, reject }).run()
      );

      ytext.delete(0, 6); // remove "alpha "

      const snapshot = await new Promise((resolve, reject) =>
        editor1.chain().getYSnapshot({ resolve, reject }).run()
      );

      editor1.chain().setYSnapshot({ prevSnapshot, snapshot }).run();
      await sleep(STEP_TS);
    }

    // Change live doc from editor2
    await editor2.patchDocumentText('text/x-markdown', '# LIVE CHANGE');
    await sleep(STEP_TS);

    // editor1 should still be in snapshot view (not converged to live editor2 doc yet)
    assert(
      JSON.stringify(editor1.getJSON()) !== JSON.stringify(editor2.getJSON()),
      'editor1 unexpectedly converged while snapshot mode is active',
    );

    editor1.destroy();
    editor2.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('room_switch_clears_snapshot_flags', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor } = createNewDocEditor(port, 'switch-user');
    editor.chain().changeRoom('room-snapshot-clear-a').run();
    await sleep(0);

    // const pluginState = ySyncPluginKey.getState(editor.state)!;
    // const ydoc = pluginState.ydoc;
    // ydoc.gc = false;
    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      const p = new Y.XmlElement('paragraph');
      p.insert(0, [new Y.XmlText('one two')]);
      yxml.insert(0, [p]);

      const prevSnapshot = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      (p.firstChild as Y.XmlText).delete(0, 4);

      const snapshot = await new Promise((resolve, reject) =>
        editor.chain().getYSnapshot({ resolve, reject }).run()
      );

      editor.chain().setYSnapshot({ prevSnapshot, snapshot }).run();
      await sleep(STEP_TS);

      assert(!editor.editable, 'editor should be readonly');
    }

    addEventListener('error', (event) => {
      console.error('111Uncaught error:', event.error);
    });
    addEventListener('unhandledrejection', (event) => {
      console.error('❌ Unhandled rejection reason:', event.reason);
      console.error('📦 Promise:', event.promise);
    });

    // Switch room -> plugin apply branch resets snapshot/prevSnapshot
    editor.chain().changeRoom('room-snapshot-clear-b').run();
    await sleep(STEP_TS);

    assert(editor.editable, 'editor should be editable');

    editor.destroy();
    await sleep(STEP_TS);
  } catch (err) {
    console.error(err);
  } finally {
    await shutdownServer(server);
  }
});
