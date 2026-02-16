import { EditorState } from 'prosemirror-state';
import * as Y from 'yjs';

import { DummyEditorView } from '@kerebron/editor/DummyEditorView';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from '../src/lib.ts';
import { ySyncPlugin } from '../src/ySyncPlugin.ts';
import { yUndoPlugin } from '../src/yUndoPlugin.ts';

import { schema as codeSchema } from './codeSchema.ts';
import { createEmptyMeta } from './convertUtils.ts';
import { ProsemirrorBinding } from '../src/ProsemirrorBinding.ts';
import { debugYDoc } from '@kerebron/extension-yjs/debug';

const createNewComplexProsemirrorView = (y: Y.Doc, undoManager = false) => {
  const view = new DummyEditorView({
    state: EditorState.create({
      schema: codeSchema,
      // plugins: [ySyncPlugin(codeSchema)].concat(
      //   undoManager ? [yUndoPlugin()] : [],
      // ),
    }),
  });
  return view;
};

Deno.test('position conversion', () => {
  // <code_block>bbbbb2</code_block>
  // <code_block lang="yaml">TEST</code_block>
  //

  // const ydoc = new Y.Doc()
  // const yxmlElement = ydoc.get('prosemirror', Y.XmlElement)

  const ydoc = new Y.Doc();
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  // {"type":"doc_code","content":[{"type":"code_block","attrs":{"lang":null},"content":[{"type":"text","text":"saaadddxxxxxxxxdxxxxxxsssx"}]}]}

  // Object { prosemirror: '<code_block lang="yaml"></code_block>' }
  // Object { prosemirror: '<code_block>saaadddxxxxxxxxdxxxxxxsssx</code_block><code_block lang="yaml"></code_block>' }
  // Object { prosemirror: "<code_block>saaadddxxxxxxxxdxxxxxxsssx</code_block>" }

  ydoc.transact(() => {
    const code_block = new Y.XmlElement('code-block');
    code_block.setAttribute('lang', 'yaml');

    const yxmlText = new Y.XmlText('TEST');
    code_block.insert(0, [yxmlText]);

    yxml.insert(0, [code_block]);

    // const permanentUserData = new Y.PermanentUserData(ydoc)
    // permanentUserData.setUserMapping(ydoc, ydoc.clientID, 'me')
    console.log('yxml', yxml.toString());
  });

  const view = createNewComplexProsemirrorView(ydoc);

  // const p = new Y.XmlElement('paragraph')
  // const ytext = new Y.XmlText('hello world!')
  // p.insert(0, [ytext])
  // yxml.insert(0, [p])
  // const snapshotDoc1 = Y.encodeStateAsUpdateV2(ydoc)
  // ytext.delete(0, 6)
  // const snapshotDoc2 = Y.encodeStateAsUpdateV2(ydoc)
  // view.dispatch(
  //   view.state.tr.setMeta(ySyncPluginKey, { snapshot: snapshotDoc2, prevSnapshot: snapshotDoc1, permanentUserData })
  // )
  //
  //

  const yXmlFragment = yxml;

  const meta = createEmptyMeta();
  const mapping = meta.mapping;

  const binding = new ProsemirrorBinding(yXmlFragment, mapping);

  const getRelativeSelection = (
    pmbinding: ProsemirrorBinding,
    state: EditorState,
  ) => ({
    type: (
      /** @type {any} */
      state.selection.jsonID
    ),
    anchor: absolutePositionToRelativePosition(
      state.selection.anchor,
      pmbinding.type,
      pmbinding.mapping,
    ),
    head: absolutePositionToRelativePosition(
      state.selection.head,
      pmbinding.type,
      pmbinding.mapping,
    ),
  });

  const relSel = getRelativeSelection(binding, view.state);

  const anchor = relativePositionToAbsolutePosition(
    binding.ydoc,
    binding.type,
    relSel.anchor,
    binding.mapping,
  );
  const head = relativePositionToAbsolutePosition(
    binding.ydoc,
    binding.type,
    relSel.head,
    binding.mapping,
  );

  console.log('pdoc', JSON.stringify(view.state.doc.toJSON()));
  console.log('ydoc', debugYDoc(ydoc));
});
