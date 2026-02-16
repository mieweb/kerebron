import { Schema } from 'prosemirror-model';
import { findWrapping } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';
import * as math from 'lib0/math';
import * as prng from 'lib0/prng';
import * as Y from 'yjs';
import { applyRandomTests } from 'yjs/testHelper';

import { EditorState, TextSelection } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey } from '../src/keys.ts';
import { YSyncPluginState } from '../src/ySyncPlugin.ts';

function createNewProsemirrorView() {
  const editor = CoreEditor.create({
    editorKits: [
      new BrowserLessEditorKit(),
      YjsEditorKit.createFrom('test-user', 'ws://localhost:12345'),
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

function createPmChanges(schema: Schema) {
  let charCounter = 0;

  const marksChoices = [
    [schema.mark('strong')],
    [schema.mark('textColor', { color: 1 })],
    [schema.mark('textColor', { color: 2 })],
    [schema.mark('em')],
    [schema.mark('em'), schema.mark('strong')],
    [],
    [],
  ];

  const pmChanges = [
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // insert text
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const marks = prng.oneOf(gen, marksChoices);
      const tr = p.state.tr;
      const text = charCounter++ + prng.word(gen);
      p.dispatch(tr.insert(insertPos, schema.text(text, marks)));
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // delete text
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const overwrite = math.min(
        prng.int32(gen, 0, p.state.doc.content.size - insertPos),
        2,
      );
      p.dispatch(p.state.tr.insertText('', insertPos, insertPos + overwrite));
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // format text
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const formatLen = math.min(
        prng.int32(gen, 0, p.state.doc.content.size - insertPos),
        2,
      );
      const mark =
        prng.oneOf(gen, marksChoices.filter((choice) => choice.length > 0))[0];
      p.dispatch(p.state.tr.addMark(insertPos, insertPos + formatLen, mark));
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // replace text
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const overwrite = math.min(
        prng.int32(gen, 0, p.state.doc.content.size - insertPos),
        2,
      );
      const text = charCounter++ + prng.word(gen);
      p.dispatch(p.state.tr.insertText(text, insertPos, insertPos + overwrite));
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // insert paragraph
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const marks = prng.oneOf(gen, marksChoices);
      const tr = p.state.tr;
      const text = charCounter++ + prng.word(gen);
      p.dispatch(
        tr.insert(
          insertPos,
          schema.node('paragraph', undefined, schema.text(text, marks)),
        ),
      );
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // insert codeblock
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const tr = p.state.tr;
      const text = charCounter++ + prng.word(gen);
      p.dispatch(
        tr.insert(
          insertPos,
          schema.node('code_block', undefined, schema.text(text)),
        ),
      );
    },
    (_y: Y.Doc, gen: prng.PRNG, p: EditorView) => { // wrap in blockquote
      const insertPos = prng.int32(gen, 0, p.state.doc.content.size);
      const overwrite = prng.int32(
        gen,
        0,
        p.state.doc.content.size - insertPos,
      );
      const tr = p.state.tr;
      tr.setSelection(
        TextSelection.create(tr.doc, insertPos, insertPos + overwrite),
      );
      const $from = tr.selection.$from;
      const $to = tr.selection.$to;
      const range = $from.blockRange($to);
      const wrapping = range && findWrapping(range, schema.nodes.blockquote);
      if (wrapping) {
        p.dispatch(tr.wrap(range, wrapping));
      }
    },
  ];

  return pmChanges;
}

const checkResult = (
  result: { testObjects: Array<{ state: EditorState }> },
) => {
  for (let i = 1; i < result.testObjects.length; i++) {
    const p1 = result.testObjects[i - 1].state.doc.toJSON();
    const p2 = result.testObjects[i].state.doc.toJSON();
    assertEquals(p1, p2);
  }
};

const tc = { prng: prng.create(+new Date()) };

Deno.test('testRepeatGenerateProsemirrorChanges2', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);

  checkResult(applyRandomTests(tc, pmChanges, 2, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges3', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 3, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges30', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 30, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges40', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 40, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges70', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 70, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges100', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 100, initTestObject));
});

Deno.test('testRepeatGenerateProsemirrorChanges300', () => {
  const { schema, view } = createNewProsemirrorView();
  const initTestObject = () => view;
  const pmChanges = createPmChanges(schema);
  checkResult(applyRandomTests(tc, pmChanges, 300, initTestObject));
});
