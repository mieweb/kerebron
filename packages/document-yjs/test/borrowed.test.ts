import { assert, assertEquals, assertThrows } from '@std/assert';
import { Schema } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { CoreEditor } from '@kerebron/editor';
import { PmYjsBinding } from '../../extension-yjs/src/binding/PmYjsBinding.ts';
import type { YjsProvider } from '../../extension-yjs/src/YjsProvider.ts';
import {
  createBorrowedBodyKit,
  fragmentToProseMirror,
  initializeFragment,
} from '../src/mod.ts';
import {
  ySyncPluginKey,
  yUndoPluginKey,
} from '../../extension-yjs/src/keys.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
});
const paragraph = (text: string) =>
  schema.node('doc', null, [
    schema.node('paragraph', null, text ? schema.text(text) : undefined),
  ]);

Deno.test('public borrowed kits use separate undo origins for two views of one fragment', async () => {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment('body');
  initializeFragment(fragment, paragraph('Seed'));
  const awareness = new Awareness(doc);
  const first = editor('');
  const second = editor('');
  const firstKit = createBorrowedBodyKit({ doc, fragment, awareness });
  const secondKit = createBorrowedBodyKit({ doc, fragment, awareness });
  for (const [view, kit] of [[first, firstKit], [second, secondKit]] as const) {
    const extension = kit.getExtensions()[0] as {
      setEditor(editor: CoreEditor): void;
      getProseMirrorPlugins(): import('prosemirror-state').Plugin[];
    };
    extension.setEditor(view);
    (view as unknown as { state: EditorState }).state = EditorState.create({
      schema,
      doc: paragraph(''),
      plugins: extension.getProseMirrorPlugins(),
    });
    kit.connect(view);
  }
  await Promise.resolve();
  first.dispatchTransaction(
    first.state.tr.insertText(' A', first.state.doc.content.size - 1),
  );
  ySyncPluginKey.getState(first.state)!.binding.pmChanged();
  second.dispatchTransaction(
    second.state.tr.insertText(' B', second.state.doc.content.size - 1),
  );
  ySyncPluginKey.getState(second.state)!.binding.pmChanged();
  assertEquals(fragmentToProseMirror(fragment, schema).textContent, 'Seed A B');
  const firstUndo = yUndoPluginKey.getState(first.state)!.undoManager!;
  assertEquals(firstUndo.undoStack.length, 1);
  firstUndo.undo();
  assertEquals(fragmentToProseMirror(fragment, schema).textContent, 'Seed B');
  assertEquals(second.state.doc.textContent, 'Seed B');
  firstKit.dispose();
  assert(!doc.isDestroyed);
  second.dispatchTransaction(
    second.state.tr.insertText(' stays', second.state.doc.content.size - 1),
  );
  ySyncPluginKey.getState(second.state)!.binding.pmChanged();
  assertEquals(
    fragmentToProseMirror(fragment, schema).textContent,
    'Seed B stays',
  );
  secondKit.dispose();
  awareness.destroy();
  doc.destroy();
});

function editor(initial: string) {
  const value = {
    schema,
    state: EditorState.create({ schema, doc: paragraph(initial) }),
    view: undefined,
    dispatchTransaction(transaction: Transaction) {
      this.state = this.state.apply(transaction);
    },
  };
  return value as unknown as CoreEditor;
}

Deno.test('borrowed named fragment imports already-synced state once and detaches without destroying host', async () => {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment('body:visit-note');
  const otherBody = doc.getXmlFragment('body:other-field');
  initializeFragment(fragment, paragraph('Shared note'));
  initializeFragment(otherBody, paragraph('Separate field'));
  const awareness = new Awareness(doc);
  let destroyed = 0;
  const provider = Object.assign(new EventTarget(), {
    doc,
    awareness,
    synced: true,
    destroy() {
      destroyed++;
    },
  }) as YjsProvider;
  const first = editor('stale first view');
  const second = editor('stale second view');
  const firstOrigin = {};
  const firstBinding = new PmYjsBinding(first, {
    fragment,
    providerOwnership: 'borrowed',
    initializeFromEditor: false,
    origin: firstOrigin,
  });
  const secondBinding = new PmYjsBinding(second, {
    fragment,
    providerOwnership: 'borrowed',
    initializeFromEditor: false,
    origin: {},
  });
  firstBinding.changeUser(
    { id: 'synthetic-user' } as import('@kerebron/editor/user').User,
  );
  for (
    const [view, binding] of [[first, firstBinding], [
      second,
      secondBinding,
    ]] as const
  ) {
    const transaction = view.state.tr;
    binding.changeRoom('host-owned', () => [provider, doc], transaction);
    view.dispatchTransaction(transaction);
  }
  await Promise.resolve();
  assertEquals(first.state.doc.textContent, 'Shared note');
  assertEquals(second.state.doc.textContent, 'Shared note');
  assertEquals(
    fragmentToProseMirror(otherBody, schema).textContent,
    'Separate field',
  );
  assert(
    !doc.share.has('users'),
    'borrowed views must not introduce an unapproved users root',
  );
  let lastOrigin: unknown;
  doc.on('afterTransaction', (transaction) => {
    lastOrigin = transaction.origin;
  });
  first.dispatchTransaction(
    first.state.tr.insertText(' updated', first.state.doc.content.size - 1),
  );
  firstBinding.pmChanged();
  assertEquals(second.state.doc.textContent, 'Shared note updated');
  assertEquals(lastOrigin, firstOrigin);
  firstBinding.destroy();
  assertEquals(destroyed, 0);
  second.dispatchTransaction(
    second.state.tr.insertText(' again', second.state.doc.content.size - 1),
  );
  secondBinding.pmChanged();
  assertEquals(
    fragmentToProseMirror(fragment, schema).textContent,
    'Shared note updated again',
  );
  assertEquals(first.state.doc.textContent, 'Shared note updated');
  secondBinding.destroy();
  awareness.destroy();
  doc.destroy();
});

Deno.test('detaching before queued sync never reseeds the canonical body', async () => {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment('body');
  const awareness = new Awareness(doc);
  const provider = Object.assign(new EventTarget(), {
    doc,
    awareness,
    synced: true,
    destroy() {
      throw new Error('Host transport destroyed');
    },
  }) as YjsProvider;
  const view = editor('must never seed');
  const binding = new PmYjsBinding(view, {
    fragment,
    providerOwnership: 'borrowed',
    initializeFromEditor: false,
  });
  binding.changeRoom('borrowed', () => [provider, doc], view.state.tr);
  binding.destroy();
  await Promise.resolve();
  assertEquals(fragment.length, 0);
  initializeFragment(fragment, paragraph('Initialized by host'));
  assertThrows(
    () => initializeFragment(fragment, paragraph('Duplicate')),
    Error,
    'already',
  );
  awareness.destroy();
  doc.destroy();
});
