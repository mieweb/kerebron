import * as Y from 'yjs';

import { TextSelection } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assert } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey, yUndoPluginKey } from '../src/keys.ts';
import { YSyncPluginState } from '../src/ySyncPlugin.ts';
import { redo, undo } from '../src/yUndoPlugin.ts';

function createNewProsemirrorViewWithUndoManager() {
  const editor = CoreEditor.create({
    editorKits: [
      new BrowserLessEditorKit(),
      YjsEditorKit.createFrom('test-user', 'ws://localhost:1234'),
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

Deno.test('testAddToHistoryIgnore', () => {
  const { ydoc, schema, view } = createNewProsemirrorViewWithUndoManager();
  // perform two changes that are tracked by um - supposed to be merged into a single undo-manager item
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('123'),
      ),
    ),
  );
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('456'),
      ),
    ),
  );
  const yxml: Y.XmlFragment = ydoc.get('prosemirror', Y.XmlFragment);
  assert(
    yxml.length === 3 && yxml.get(0).length === 1,
    'contains inserted content (1)',
  );
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('abc'),
      ),
    ).setMeta('addToHistory', false),
  );
  assert(
    yxml.length === 4 && yxml.get(0).length === 1,
    'contains inserted content (2)',
  );
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('xyz'),
      ),
    ),
  );
  assert(
    yxml.length === 5 && yxml.get(0).length === 1,
    'contains inserted content (3)',
  );
  undo(view.state);
  assert(yxml.length === 4, 'insertion (3) was undone');
  undo(view.state);
  console.log(yxml.toString());
  assert(
    yxml.length === 1 &&
      yxml.get(0).toString() === '<paragraph>abc</paragraph>',
    'insertion (1) was undone',
  );
});

/**
 * Reproducing #190
 */
Deno.test('testCursorPositionAfterUndoOnEndText', () => {
  const { ydoc, schema, view } = createNewProsemirrorViewWithUndoManager();
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('123'),
      ),
    ),
  );
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'contains inserted content',
  );
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.between(
        view.state.doc.resolve(4),
        view.state.doc.resolve(4),
      ),
    ),
  );
  const undoManager = yUndoPluginKey.getState(view.state)?.undoManager!;
  undoManager.stopCapturing();
  // clear undo manager
  view.dispatch(
    view.state.tr.delete(3, 4),
  );
  undo(view.state);
  assert(view.state.selection.anchor === 4);
});

Deno.test('testAddToHistory', () => {
  const { ydoc, schema, view } = createNewProsemirrorViewWithUndoManager();
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('123'),
      ),
    ),
  );
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'contains inserted content',
  );
  undo(view.state);
  assert(yxml.length === 0, 'insertion was undone');
  redo(view.state);
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'contains inserted content',
  );
  undo(view.state);
  assert(yxml.length === 0, 'insertion was undone');
  // now insert content again, but with `'addToHistory': false`
  view.dispatch(
    view.state.tr.insert(
      0,
      /** @type {any} */ (schema.node(
        'paragraph',
        undefined,
        schema.text('123'),
      )),
    ).setMeta('addToHistory', false),
  );
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'contains inserted content',
  );
  undo(view.state);
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'insertion was *not* undone',
  );
});
