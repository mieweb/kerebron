import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { ChangeSet } from 'prosemirror-changeset';

import { next as automerge } from '@automerge/automerge/slim';
import { pmToAm } from './pmToAm.ts';
import { amToPm } from './amToPm.ts';
import { amSpansToDoc } from './amTraversal.ts';
import { SchemaAdapter } from './SchemaAdapter.ts';
import { isArrayEqual } from './utils.ts';
import { DocHandle, DocHandleChangePayload } from './types.ts';
import { EditorView } from 'prosemirror-view';

export const syncPluginKey = new PluginKey('automerge-sync');

export class SyncPlugin<T> extends Plugin {
  ignoreTr = false;
  onAutoMergeChange!: (args: DocHandleChangePayload<unknown>) => void;

  private handle!: DocHandle<T>;
  private view!: EditorView;

  constructor(
    private adapter: SchemaAdapter,
    private path: automerge.Prop[],
    handle: DocHandle<T>,
  ) {
    super({
      key: syncPluginKey,
      view: (view) => {
        this.view = view;
        this.changeHandle(handle);

        return {
          destroy: () => {
            if (this.handle) {
              this.handle.off('change', this.onAutoMergeChange);
            }
          },
        };
      },
      appendTransaction(transactions, oldState, state) {
        if (this.ignoreTr) return;

        transactions = transactions.filter((tx) => tx.docChanged);
        if (transactions.length === 0) return undefined;

        //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const docBefore = this.handle.docSync()!;
        const headsBefore = automerge.getHeads(docBefore);
        const spansBefore = automerge.spans(docBefore, path);

        // Apply transactions to the automerge doc
        this.ignoreTr = true;
        this.handle.change((doc: automerge.Doc<T>) => {
          for (const tx of transactions) {
            const spans = automerge.spans(doc, path);
            pmToAm(adapter, spans, tx.steps, doc, tx.docs[0], path);
          }
        });
        this.ignoreTr = false;

        //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const docAfter = this.handle.docSync()!;
        const headsAfter = automerge.getHeads(docAfter);
        const spansAfter = automerge.spans(docAfter, path);

        // Ignore if nothing changed.
        if (isArrayEqual(headsBefore, headsAfter)) return undefined;

        // Check if ProseMirror doc matches the AutoMerge doc
        // by comparing changesets between the two transactions.
        const patches = automerge.diff(docAfter, headsBefore, headsAfter);
        const tx = amToPm(adapter, spansBefore, patches, path, oldState.tr);

        let amChangeSet = ChangeSet.create(oldState.doc);
        amChangeSet = amChangeSet.addSteps(
          oldState.doc,
          tx.mapping.maps,
          undefined,
        );

        let pmChangeSet = ChangeSet.create(oldState.doc);
        for (const tr of transactions) {
          pmChangeSet = pmChangeSet.addSteps(
            tr.docs[0],
            tr.mapping.maps,
            undefined,
          );
        }

        const diff = pmChangeSet.changedRange(amChangeSet);
        if (!diff || diff.from === diff.to) return undefined;

        console.warn(
          "Warning: ProseMirror doc doesn't match AutoMerge spans.\n\n" +
            'State will be automatically fixed with a tr. File an issue at https://github.com/automerge/automerge-repo.\n',
          {
            spansBefore,
            steps: transactions.map((tr) => tr.steps.map((s) => s.toJSON())),
          },
        );

        // Replace the diff range in ProseMirror doc from the AutoMerge doc.
        const doc = amSpansToDoc(adapter, spansAfter);
        const slice = doc.slice(diff.from, diff.to);
        const tr = state.tr;
        tr.replace(diff.from, diff.to, slice);
        try {
          tr.setSelection(Selection.fromJSON(tr.doc, state.selection.toJSON()));
        } catch (e) {
          if (e instanceof RangeError) {
            // Sometimes the selection can't be mapped for some reason, so we just give up and hope for the best
          } else {
            throw e;
          }
        }
        tr.setStoredMarks(state.storedMarks);
        return tr;
      },
    });
  }
  changeHandle(handle: DocHandle<any>) {
    if (!this.view) {
      return;
    }
    if (this.handle) {
      this.handle.off('change', this.onAutoMergeChange);
    }

    const onAutoMergeChange: (
      args: DocHandleChangePayload<unknown>,
    ) => void = ({
      doc,
      patches,
      patchInfo,
    }) => {
      if (this.ignoreTr) return;

      const headsBefore = automerge.getHeads(patchInfo.before);
      const spans = automerge.spans(
        automerge.view(doc, headsBefore),
        this.path,
      );
      const tr = amToPm(
        this.adapter,
        spans,
        patches,
        this.path,
        this.view.state.tr,
      );
      tr.setMeta('addToHistory', false); // remote changes should not be added to local stack

      this.ignoreTr = true;
      this.view.dispatch(tr);
      this.ignoreTr = false;
    };
    this.onAutoMergeChange = onAutoMergeChange;

    handle.on('change', this.onAutoMergeChange);
    this.handle = handle;
  }
}
