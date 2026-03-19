import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { assert, assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { ySyncPluginKey } from '../src/keys.ts';

import { createTestServer, shutdownServer } from './utils/createTestServer.ts';
import { assetLoad } from '@kerebron/wasm/deno';

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

Deno.test('join_existing_room_prefers_remote_content', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writer } = createNewDocEditor(port, 'writer');
    await writer.loadDocumentText(
      'text/x-markdown',
      '# Existing Remote Content',
    );
    writer.chain().changeRoom('room-existing').run();

    const { editor: joiner } = createNewDocEditor(port, 'joiner');
    joiner.chain().changeRoom('room-existing').run();

    await waitFor(
      () =>
        JSON.stringify(joiner.getJSON()) === JSON.stringify(writer.getJSON()),
      { message: 'joiner did not render existing room content' },
    );

    assertEquals(joiner.getJSON(), writer.getJSON());

    writer.destroy();
    joiner.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('explicit_import_overwrites_room_and_propagates', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: editor1 } = createNewDocEditor(port, 'user-a');
    const { editor: editor2 } = createNewDocEditor(port, 'user-b');

    editor1.chain().changeRoom('room-overwrite').run();
    editor2.chain().changeRoom('room-overwrite').run();

    await editor1.patchDocumentText('text/x-markdown', '# Old Shared Content');
    await waitFor(
      () =>
        JSON.stringify(editor1.getJSON()) === JSON.stringify(editor2.getJSON()),
      { message: 'initial shared content did not converge' },
    );

    // Explicit overwrite flow: already in room, then import another document
    await editor2.patchDocumentText(
      'text/x-markdown',
      '# New Imported Content',
    );

    await waitFor(
      () =>
        JSON.stringify(editor1.getJSON()) === JSON.stringify(editor2.getJSON()),
      { message: 'overwrite import did not propagate to peer' },
    );

    const out1 = new TextDecoder().decode(
      await editor1.saveDocument('text/x-markdown'),
    );
    assert(out1.includes('New Imported Content'));

    editor1.destroy();
    editor2.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('room_switch_rebinds_to_new_fragment', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: editor1 } = createNewDocEditor(port, 'user-a');
    const { editor: editor2 } = createNewDocEditor(port, 'user-b');

    editor1.chain().changeRoom('room-A').run();
    editor2.chain().changeRoom('room-A').run();

    await editor1.patchDocumentText('text/x-markdown', '# Room A Document');
    await waitFor(
      () =>
        JSON.stringify(editor1.getJSON()) === JSON.stringify(editor2.getJSON()),
      { message: 'room-A did not converge before switch' },
    );

    // Switch editor2 away from room-A
    editor2.chain().changeRoom('room-B').run();
    await sleep(150);

    // Change room-A again from editor1
    await editor1.loadDocumentText('text/x-markdown', '# Room A Updated');

    // editor2 should NOT track editor1 anymore after switching to room-B
    await sleep(300);
    assert(
      JSON.stringify(editor1.getJSON()) !== JSON.stringify(editor2.getJSON()),
      'editor2 still changed with room-A after switching to room-B',
    );

    editor1.destroy();
    editor2.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('rapid_room_switch_last_room_wins', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writerA } = createNewDocEditor(port, 'writer-a');
    await writerA.loadDocumentText('text/x-markdown', '# A content');
    writerA.chain().changeRoom('room-fast-a').run();

    const { editor: writerB } = createNewDocEditor(port, 'writer-b');
    await writerB.loadDocumentText('text/x-markdown', '# B content');
    writerB.chain().changeRoom('room-fast-b').run();

    const { editor: joiner } = createNewDocEditor(port, 'joiner');

    joiner.chain().changeRoom('room-fast-a').run();
    joiner.chain().changeRoom('room-fast-b').run();

    await waitFor(
      () =>
        JSON.stringify(joiner.getJSON()) === JSON.stringify(writerB.getJSON()),
      { message: 'joiner did not converge to last selected room' },
    );

    assert(
      JSON.stringify(joiner.getJSON()) !== JSON.stringify(writerA.getJSON()),
      'joiner incorrectly remained on first room',
    );

    writerA.destroy();
    writerB.destroy();
    joiner.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('join_empty_room_imports_local_doc_if_policy_enabled', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    // Local editor with draft content before joining Yjs
    const { editor: local } = createNewDocEditor(port, 'local');
    await local.loadDocumentText(
      'text/x-markdown',
      '# Local Draft Before Join',
    );

    // Join empty room
    local.chain().changeRoom('room-empty-import-policy').run();

    await sleep(100);

    // Another peer joins same room and should see imported content
    const { editor: peer } = createNewDocEditor(port, 'peer');
    peer.chain().changeRoom('room-empty-import-policy').run();

    await waitFor(
      () => JSON.stringify(peer.getJSON()) === JSON.stringify(local.getJSON()),
      { message: 'peer did not receive imported local doc into empty room' },
    );

    const outPeer = new TextDecoder().decode(
      await peer.saveDocument('text/x-markdown'),
    );
    assert(outPeer.includes('Local Draft Before Join'));

    peer.destroy();
    local.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('join_non_empty_room_does_not_auto_overwrite_existing_content', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writer } = createNewDocEditor(port, 'writer');
    await writer.loadDocumentText('text/x-markdown', '# Existing Room Content');
    writer.chain().changeRoom('room-non-empty-policy').run();

    const { editor: local } = createNewDocEditor(port, 'local');
    await local.loadDocumentText(
      'text/x-markdown',
      '# Local Draft Should Not Auto-Overwrite',
    );

    // Join room that already has content
    local.chain().changeRoom('room-non-empty-policy').run();

    await waitFor(
      () =>
        JSON.stringify(local.getJSON()) === JSON.stringify(writer.getJSON()),
      { message: 'local did not adopt existing room content' },
    );

    const outWriter = new TextDecoder().decode(
      await writer.saveDocument('text/x-markdown'),
    );
    assert(outWriter.includes('Existing Room Content'));
    assert(!outWriter.includes('Local Draft Should Not Auto-Overwrite'));

    writer.destroy();
    local.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('explicit_force_overwrite_replaces_non_empty_room_and_propagates', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writer } = createNewDocEditor(port, 'writer');
    const { editor: importer } = createNewDocEditor(port, 'importer');
    const { editor: peer } = createNewDocEditor(port, 'peer');

    writer.chain().changeRoom('room-force-overwrite').run();
    importer.chain().changeRoom('room-force-overwrite').run();
    peer.chain().changeRoom('room-force-overwrite').run();
    await sleep(100);

    writer.chain();
    await writer.patchDocumentText(
      'text/x-markdown',
      '# Baseline Shared Content',
    );

    await waitFor(
      () => JSON.stringify(writer.getJSON()) === JSON.stringify(peer.getJSON()),
      { message: 'baseline content did not propagate' },
    );

    await importer.patchDocumentText(
      'text/x-markdown',
      '# Forced Imported Content',
    );

    await waitFor(
      () =>
        JSON.stringify(importer.getJSON()) === JSON.stringify(peer.getJSON()),
      { message: 'forced overwrite did not propagate to peer' },
    );

    const outWriter = new TextDecoder().decode(
      await writer.saveDocument('text/x-markdown'),
    );
    assert(outWriter.includes('Forced Imported Content'));

    writer.destroy();
    importer.destroy();
    peer.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('room_epoch_guard_ignores_stale_join_callbacks', async () => {
  const server = await createTestServer();
  const port = server.port;

  try {
    const { editor: writerA } = createNewDocEditor(port, 'writer-a');
    await writerA.loadDocumentText('text/x-markdown', '# Room A Final');
    writerA.chain().changeRoom('room-epoch-a').run();

    const { editor: writerB } = createNewDocEditor(port, 'writer-b');
    await writerB.loadDocumentText('text/x-markdown', '# Room B Final');
    writerB.chain().changeRoom('room-epoch-b').run();

    const { editor: joiner } = createNewDocEditor(port, 'joiner');

    // Simulate rapid changes that can produce stale async callbacks
    joiner.chain().changeRoom('room-epoch-a').run();
    joiner.chain().changeRoom('room-epoch-b').run();
    await sleep(100);

    await waitFor(
      () =>
        JSON.stringify(joiner.getJSON()) === JSON.stringify(writerB.getJSON()),
      { message: 'joiner did not converge to latest room selection' },
    );

    const outJoiner = new TextDecoder().decode(
      await joiner.saveDocument('text/x-markdown'),
    );

    assert(outJoiner.includes('Room B Final'));
    assert(!outJoiner.includes('Room A Final'));

    writerA.destroy();
    writerB.destroy();
    joiner.destroy();
    await sleep(100);
  } finally {
    await shutdownServer(server);
  }
});
