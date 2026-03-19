import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessCodeEditorKit } from '@kerebron/editor-browserless/BrowserLessCodeEditorKit';
import { assert, assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { createTestServer, shutdownServer } from './utils/createTestServer.ts';

function createNewDocEditor(port: number, user = 'test-user') {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessCodeEditorKit({ lang: 'txt' }),
      YjsEditorKit.createFrom('ws://localhost:' + port + '/yjs'),
    ],
  });

  return { editor };
}

const STEP_TS = 50;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.test('testEmptyNotSync', async () => {
  const server = await createTestServer();

  try {
    const { editor: editor1 } = createNewDocEditor(server.port);
    editor1.chain().changeRoom('room1').run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc_code', Y.XmlFragment);
      console.log('type.toString()', yxml.toString());
      assert(yxml.toString() === '', 'should only sync after first change');
    }

    // view.dispatch(
    //   view.state.tr.setNodeMarkup(0, undefined, {
    //     checked: true,
    //   }),
    // );
    // assertEquals(
    //   type.toString(),
    //   '<custom checked="true"></custom>',
    // );

    editor1.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('testSync', async () => {
  const server = await createTestServer();

  try {
    const { editor: editor1 } = createNewDocEditor(
      server.port,
    );
    await editor1.loadDocumentText('text/code-only', 'Some text');

    const { editor: editor2 } = createNewDocEditor(
      server.port,
    );

    editor1.chain().changeRoom('room1').run();
    editor2.chain().changeRoom('room1').run();

    const out2 = await editor2.saveDocument('text/code-only');
    // console.log('out2', out2);

    {
      const ydoc1: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );

      // console.log('ydoc1', ydoc1);
      const yxml: Y.XmlFragment = ydoc1.get('kerebron:doc_code', Y.XmlFragment);
      console.log('type.toString()', yxml.toString());
      assert(yxml.toString() === '', 'should only sync after first change');

      const type2 = ydoc1.getXmlFragment('prosemirror');
    }

    // view.dispatch(
    //   view.state.tr.setNodeMarkup(0, undefined, {
    //     checked: true,
    //   }),
    // );
    // assertEquals(
    //   type.toString(),
    //   '<custom checked="true"></custom>',
    // );

    editor1.destroy();
    editor2.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});
