import * as Y from 'yjs';

import { assertEquals } from '@std/assert';

import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { CoreEditor, EditorKit, Extension } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assetLoad } from '@kerebron/wasm/deno';

import { PmYjsBinding } from '../src/binding/PmYjsBinding.ts';
import { WebsocketProvider } from '../src/WebsocketProvider.ts';
import { CreateYjsProvider, YjsProvider } from '../src/YjsProvider.ts';
import { createTestServer, shutdownServer } from './utils/createTestServer.ts';
import {
  appendNewParagraph,
  appendTextToFirstNode,
} from './utils/pmCommands.ts';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const STEP_TS = 50;

Deno.test('testEmptyNotSync', async () => {
  const roomId = 'test';

  const server = await createTestServer();
  const port = server.port;

  try {
    const editor1 = CoreEditor.create({
      assetLoad,
      editorKits: [
        new BrowserLessEditorKit(),
        YjsEditorKit.createFrom('ws://localhost:' + port + '/yjs'),
      ],
    });
    await editor1.loadDocumentText('text/x-markdown', '# Markdown doc');

    editor1.chain().changeRoom(roomId).run();

    await sleep(STEP_TS);

    const editor2 = CoreEditor.create({
      assetLoad,
      editorKits: [
        new BrowserLessEditorKit(),
        YjsEditorKit.createFrom('ws://localhost:' + port + '/yjs'),
      ],
    });

    editor2.chain().changeRoom(roomId).run();
    await sleep(STEP_TS);

    {
      const md1 = new TextDecoder().decode(
        await editor1.saveDocument('text/x-markdown'),
      );
      const md2 = new TextDecoder().decode(
        await editor2.saveDocument('text/x-markdown'),
      );
      assertEquals(md1, md2);
    }

    // const command = appendNewParagraph('Para2');
    const command = appendTextToFirstNode(' more text');

    command(
      editor1.state,
      (tx) => editor1.dispatchTransaction(tx),
      editor1.view as EditorView,
    );
    await sleep(STEP_TS);

    {
      const md1 = new TextDecoder().decode(
        await editor1.saveDocument('text/x-markdown'),
      );
      const md2 = new TextDecoder().decode(
        await editor2.saveDocument('text/x-markdown'),
      );
      assertEquals(md1, md2);
    }

    editor1.destroy();
    editor2.destroy();
    await sleep(STEP_TS);
  } finally {
    shutdownServer(server);
  }
});
