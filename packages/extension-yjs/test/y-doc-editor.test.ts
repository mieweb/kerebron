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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  condition: () => boolean,
  {
    timeoutMs = 3000,
    stepMs = 25,
    message = 'waitFor timeout',
  }: { timeoutMs?: number; stepMs?: number; message?: string } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (condition()) return;
    await sleep(stepMs);
  }
  throw new Error(message);
}

const STEP_TS = 50;

Deno.test('local_pm_change_propagates_to_remote_peer', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: editor1 } = createNewDocEditor(port, 'user-a');
    await editor1.loadDocumentText('text/x-markdown', '# Hello from A');

    const { editor: editor2 } = createNewDocEditor(port, 'user-b');

    editor1.chain().changeRoom('room-local-propagation').run();
    editor2.chain().changeRoom('room-local-propagation').run();

    await waitFor(
      () =>
        JSON.stringify(editor1.getJSON()) === JSON.stringify(editor2.getJSON()),
      { message: 'editor2 did not receive propagated PM change' },
    );

    assertEquals(editor2.getJSON(), editor1.getJSON());

    editor1.destroy();
    editor2.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('suppress_pm_writes_until_initial_sync_prevents_early_push', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writer } = createNewDocEditor(port, 'writer');
    await writer.loadDocumentText('text/x-markdown', '# Remote Truth');
    writer.chain().changeRoom('room-sync-gate').run();

    // Prepare local content before join; with sync gating this must NOT be pushed
    const { editor: joiner } = createNewDocEditor(port, 'joiner');
    await joiner.loadDocumentText('text/x-markdown', '# Local Premature Write');
    joiner.chain().changeRoom('room-sync-gate').run();

    await waitFor(
      () =>
        JSON.stringify(joiner.getJSON()) === JSON.stringify(writer.getJSON()),
      { message: 'joiner did not converge to remote truth after initial sync' },
    );

    const outWriter = new TextDecoder().decode(
      await writer.saveDocument('text/x-markdown'),
    );
    assert(outWriter.includes('Remote Truth'));
    assert(!outWriter.includes('Local Premature Write'));

    writer.destroy();
    joiner.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});
