import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import * as Y from 'yjs';

// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, Node, parseHTML } from 'npm:linkedom@latest';

import { DummyEditorView } from '../../editor/src/DummyEditorView.ts';
import { ProsemirrorBinding, ySyncPlugin } from '../src/ySyncPlugin.ts';
import { yUndoPlugin } from '../src/yUndoPlugin.ts';
import { ySyncPluginKey } from '../src/keys.ts';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from '../src/lib.ts';

import { schema as codeSchema } from './codeSchema.ts';
import { initProseMirrorDoc } from '../src/convertUtils.ts';

const createNewProsemirrorViewWithSchema = (y, schema, undoManager = false) => {
  const view = new DummyEditorView({
    state: EditorState.create({
      schema,
      plugins: [ySyncPlugin(y.get('prosemirror', Y.XmlFragment))].concat(
        undoManager ? [yUndoPlugin()] : [],
      ),
    }),
  });
  return view;
};

const createNewComplexProsemirrorView = (y: Y.Doc, undoManager = false) =>
  createNewProsemirrorViewWithSchema(y, codeSchema, undoManager);

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

  const { doc, meta, mapping } = initProseMirrorDoc(yXmlFragment, codeSchema);

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
  console.log('ydoc', JSON.stringify(ydoc));

  if (anchor !== null && head !== null) {
    console.log('ahead', anchor, head, relSel);
    // console.log("tr.doc", binding.doc, binding.doc.toJSON());

    const aaa = view.state.doc.resolve(anchor);
    console.log(aaa);

    // const sel = TextSelection.between(
    //   tr.doc.resolve(anchor),
    //   tr.doc.resolve(head)
    // );
    // tr.setSelection(sel);
  }
});
