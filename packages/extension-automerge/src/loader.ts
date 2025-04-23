import { next as automerge } from '@automerge/automerge';
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import type { SchemaAdapter } from './SchemaAdapter.ts';

import { pmToAm } from './pmToAm.ts';
import { DocHandle } from '@automerge/automerge-repo';

function removeMarksRecursively(schema: Schema, node: ProseMirrorNode) {
  if (node.isText) {
    return schema.text(node.text!);
  } else {
    const newChildren: ProseMirrorNode[] = [];
    node.content.forEach((child) => {
      newChildren.push(removeMarksRecursively(schema, child));
    });
    return node.copy(node.type.create(null, newChildren).content);
  }
}

function replaceDocWithoutMarks(
  oldState: EditorState,
  newDoc: ProseMirrorNode,
) {
  const { tr } = oldState;
  const cleanDoc = removeMarksRecursively(oldState.schema, newDoc);
  tr.replaceWith(0, oldState.doc.content.size, cleanDoc.content);
  return tr;
}

function addMarksToTransaction(doc: ProseMirrorNode, tr: Transaction) {
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      for (const mark of node.marks) {
        tr.addMark(pos, pos + node.nodeSize, mark);
      }
    }
  });
}

export function createEmptyDocFromExisting(doc: ProseMirrorNode) {
  return doc.type.createAndFill();
}

export function pmDocToAm<T>(
  basicSchemaAdapter: SchemaAdapter,
  amDoc: automerge.Doc<T>,
  docToLoad: ProseMirrorNode,
  pathToTextField = ['text'],
): automerge.Doc<T> {
  const spans = automerge.spans(amDoc, pathToTextField);

  const emptyDoc = createEmptyDocFromExisting(docToLoad)!;

  const state = EditorState.create({ doc: emptyDoc });
  const tr = replaceDocWithoutMarks(state, docToLoad);
  addMarksToTransaction(docToLoad, tr);

  return automerge.change(amDoc, (d) => {
    pmToAm(basicSchemaAdapter, spans, tr.steps, d, tr.docs[0], pathToTextField);
  });
}

export function pmDocToAmHandle<T>(
  basicSchemaAdapter: SchemaAdapter,
  handle: DocHandle<T>,
  docToLoad: ProseMirrorNode,
  pathToTextField = ['text'],
) {
  const amDoc = handle.docSync()!;
  const spans = automerge.spans(amDoc, pathToTextField);

  const emptyDoc = createEmptyDocFromExisting(docToLoad)!;

  const state = EditorState.create({ doc: emptyDoc });
  const tr = replaceDocWithoutMarks(state, docToLoad);
  addMarksToTransaction(docToLoad, tr);

  handle.change((d) => {
    pmToAm(basicSchemaAdapter, spans, tr.steps, d, tr.docs[0], pathToTextField);
  });
}
