import * as Y from 'yjs';

import { TextSelection } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assert } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey, yUndoPluginKey } from '../src/keys.ts';
import { createTestServer, shutdownServer } from './utils/createTestServer.ts';
import { EditorView } from 'prosemirror-view';
import { prependNewParagraph } from './utils/pmCommands.ts';
import { Command } from '@kerebron/editor/commands';
import { assetLoad } from '@kerebron/wasm/deno';
import { debugYNode } from '@kerebron/extension-yjs/debug';

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

// if (false)
Deno.test('testAddToHistoryIgnore', async () => {
  const server = await createTestServer();

  try {
    const { editor: editor1 } = createNewDocEditor(server.port);
    editor1.chain().changeRoom('room1').run();
    // perform two changes that are tracked by um - supposed to be merged into a single undo-manager item

    const run = async (command: Command) => {
      command(
        editor1.state,
        (tx) => editor1.dispatchTransaction(tx),
        editor1.view as EditorView,
      );
      await sleep(STEP_TS);
    };

    {
      const command = prependNewParagraph('123');
      await run(command);
    }

    {
      const command = prependNewParagraph('456');
      await run(command);
    }

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

      assert(
        yxml.length === 3 && yxml.get(0).length === 1,
        'contains inserted content (1)',
      );
    }

    {
      const command = prependNewParagraph('abc', { 'addToYjsHistory': false });
      await run(command);
    }

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 4 && yxml.get(0).length === 1,
        'contains inserted content (2)',
      );
    }

    {
      const command = prependNewParagraph('xyz');
      await run(command);
    }

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 5 && yxml.get(0).length === 1,
        'contains inserted content (3)',
      );
    }

    editor1.chain().undo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(yxml.length === 4, 'insertion (3) was undone');
    }

    editor1.chain().undo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 1 &&
          yxml.get(0).toString() === '<paragraph>abc</paragraph>',
        'insertion (1) was undone',
      );
    }

    editor1.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

// if (false)
/**
 * Reproducing https://github.com/yjs/y-prosemirror/issues/190
 */
Deno.test('testCursorPositionAfterUndoOnEndText', async () => {
  const server = await createTestServer();

  try {
    const { editor: editor1 } = createNewDocEditor(server.port);
    editor1.chain().changeRoom('room2').run();
    await sleep(STEP_TS);

    const run = async (command: Command) => {
      command(
        editor1.state,
        (tx) => editor1.dispatchTransaction(tx),
        editor1.view as EditorView,
      );
      await sleep(STEP_TS);
    };

    await run(prependNewParagraph('123'));

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        'contains inserted content',
      );
    }

    {
      const view = editor1.view;
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.between(
            view.state.doc.resolve(4),
            view.state.doc.resolve(4),
          ),
        ),
      );
    }

    const undoManager = yUndoPluginKey.getState(editor1.state)?.undoManager!;
    undoManager.stopCapturing();
    // clear undo manager

    {
      const view = editor1.view;
      view.dispatch(
        view.state.tr.delete(3, 4),
      );
    }

    editor1.chain().undo().run();

    {
      const view = editor1.view;
      assert(view.state.selection.anchor === 4);
    }

    editor1.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

// if (false)
Deno.test('testAddToHistory', async () => {
  const server = await createTestServer();

  try {
    const { editor: editor1 } = createNewDocEditor(server.port);

    const run = async (command: Command) => {
      command(
        editor1.state,
        (tx) => editor1.dispatchTransaction(tx),
        editor1.view as EditorView,
      );
      await sleep(STEP_TS);
    };

    editor1.chain().changeRoom('room3').run();
    await sleep(STEP_TS);

    await run(prependNewParagraph('123'));

    // view.dispatch(
    //   view.state.tr.insert(
    //     0,
    //     schema.node(
    //       'paragraph',
    //       undefined,
    //       schema.text('123'),
    //     ),
    //   ),
    // );

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        'contains inserted content',
      );
    }

    // undo(view.state);
    editor1.chain().undo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      // assert(yxml.length === 0, 'insertion was undone');
      assert(
        yxml.length === 1 && yxml.get(0).length === 0,
        'insertion was undone',
      );
    }

    // redo(view.state);
    editor1.chain().redo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1, // get(0)
        'contains inserted content',
      );
    }

    // undo(view.state);
    editor1.chain().undo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      // assert(yxml.length === 0, 'insertion was undone');
      assert(
        yxml.length === 1 && yxml.get(0).length === 0,
        'insertion was undone',
      );
    }

    // now insert content again, but with `'addToHistory': false`
    {
      const command = prependNewParagraph('123', { 'addToYjsHistory': false });
      await run(command);
    }

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        'contains inserted content',
      );
    }

    // undo(view.state);
    editor1.chain().undo().run();

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor1.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        'insertion was *not* undone',
      );
    }

    editor1.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

if (false) {
  Deno.test('testChangeOrigin', () => {
    // const { ydoc, schema, view } = createNewProsemirrorView();
    const yXmlFragment = ydoc.get('prosemirror', Y.XmlFragment);
    const yundoManager = new Y.UndoManager(yXmlFragment, {
      trackedOrigins: new Set(['trackme']),
    });

    view.dispatch(
      view.state.tr.insert(
        0,
        schema.node(
          'paragraph',
          undefined,
          schema.text('world'),
        ),
      ),
    );
    const ysyncState1 = ySyncPluginKey.getState(view.state)!;
    assert(ysyncState1.isChangeOrigin === false);
    assert(ysyncState1.isUndoRedoOperation === false);
    ydoc.transact(() => {
      yXmlFragment.get(0).get(0).insert(0, 'hello');
    }, 'trackme');
    const ysyncState2 = ySyncPluginKey.getState(view.state)!;
    assert(ysyncState2.isChangeOrigin === true);
    assert(ysyncState2.isUndoRedoOperation === false);
    yundoManager.undo();
    const ysyncState3 = ySyncPluginKey.getState(view.state)!;
    assert(ysyncState3.isChangeOrigin === true);
    assert(ysyncState3.isUndoRedoOperation === true);
  });
}
