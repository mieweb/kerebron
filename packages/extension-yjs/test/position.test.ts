import * as Y from 'yjs';

import { EditorState } from 'prosemirror-state';

import { DummyEditorView } from '@kerebron/editor/DummyEditorView';
import { debugYDoc } from '@kerebron/extension-yjs/debug';

import { createEmptyMeta } from '../src/binding/convertUtils.ts';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from '../src/position.ts';
import { getRelativeSelection } from '../src/ui/selection.ts';

import { schema as codeSchema } from './codeSchema.ts';

const createNewComplexProsemirrorView = () => {
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
  });

  const view = createNewComplexProsemirrorView();

  const yXmlFragment = yxml;

  const meta = createEmptyMeta();
  const mapping = meta.mapping;

  // const getRelativeSelection = (
  //   pmbinding: ProsemirrorBinding,
  //   state: EditorState,
  // ) => ({
  //   type: (
  //     /** @type {any} */
  //     state.selection.jsonID
  //   ),
  //   anchor: absolutePositionToRelativePosition(
  //     state.selection.anchor,
  //     pmbinding.type,
  //     pmbinding.mapping,
  //   ),
  //   head: absolutePositionToRelativePosition(
  //     state.selection.head,
  //     pmbinding.type,
  //     pmbinding.mapping,
  //   ),
  // });

  const relSel = getRelativeSelection(yXmlFragment, mapping, view.state);

  const anchor = relativePositionToAbsolutePosition(
    ydoc,
    yxml,
    relSel.anchor,
    mapping,
  );
  const head = relativePositionToAbsolutePosition(
    ydoc,
    yxml,
    relSel.head,
    mapping,
  );

  // console.log('pdoc', JSON.stringify(view.state.doc.toJSON()));
  // console.log('ydoc', debugYDoc(ydoc));

  // console.log('anchor', anchor);
  // console.log('head', head);
});
