import * as Y from 'yjs';

import { Node } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import { isVisible } from '../utils.ts';
import { YjsData } from './PmYjsBinding.ts';
import { createNodeFromYElement } from './createNodeFromYElement.ts';

export class DiffViewer {
  prevSnapshot?: Y.Snapshot;
  snapshot?: Y.Snapshot;

  private historyYXmlFragment: Y.XmlFragment | undefined;
  private historyDoc: Y.Doc | undefined;

  constructor() {
  }

  isActive() {
    return !!this.snapshot || !!this.prevSnapshot;
  }

  setSnapshot(yjs: YjsData, uSnapshot: Uint8Array, uPrevSnapshot?: Uint8Array) {
    this.prevSnapshot = undefined;
    if (uPrevSnapshot) {
      this.prevSnapshot = Y.decodeSnapshotV2(uPrevSnapshot);
    }

    this.snapshot = Y.decodeSnapshotV2(uSnapshot);

    this.historyDoc = Y.createDocFromSnapshot(
      yjs.ydoc,
      this.snapshot,
      new Y.Doc({ gc: false }),
    );

    if (yjs.xmlFragment._item === null) {
      /**
       * If is a root type, we need to find the root key in the initial document
       * and use it to get the history type.
       */
      const share: Map<string, Y.AbstractType<Y.YEvent<any>>> = yjs.ydoc.share;
      const rootKey = Array.from(share.keys()).find(
        (key) => share.get(key) === yjs.xmlFragment as Y.AbstractType<any>,
      );
      this.historyYXmlFragment = this.historyDoc.getXmlFragment(rootKey);
    } else {
      /**
       * If it is a sub type, we use the item id to find the history type.
       */
      const historyStructs =
        this.historyDoc.store.clients.get(yjs.xmlFragment._item.id.client) ??
          [];
      const itemIndex = Y.findIndexSS(
        historyStructs,
        yjs.xmlFragment._item.id.clock,
      );
      if (historyStructs[itemIndex] instanceof Y.GC) {
        throw new Error('Incorrect type Y.GC');
      }
      const item: Y.Item = historyStructs[itemIndex];
      const content: Y.ContentType = item.content;
      this.historyYXmlFragment = content.type as Y.XmlFragment;
    }
  }

  reset() {
    this.snapshot = undefined;
    this.prevSnapshot = undefined;
    this.historyDoc = undefined;
    this.historyYXmlFragment = undefined;
  }

  getFragmentContent(
    state: EditorState,
    ytr: Y.Transaction,
    permanentUserData?: Y.PermanentUserData,
  ): Node[] | undefined {
    if (!this.historyYXmlFragment || !this.snapshot) {
      return;
    }

    // before rendering, we are going to sanitize ops and split deleted ops
    // if they were deleted by seperate users.
    // pluginState.permanentUserData;
    if (permanentUserData) {
      permanentUserData.dss.forEach((ds) => {
        Y.iterateDeletedStructs(ytr, ds, (_item) => {});
      });
    }
    const computeYChange = (type: 'removed' | 'added', id: Y.ID) => {
      const user = permanentUserData
        ? (type === 'added'
          ? permanentUserData.getUserByClientId(id.client)
          : permanentUserData.getUserByDeletedId(id))
        : undefined;
      return {
        user,
        type,
      };
    };

    const deleteSet = this.prevSnapshot
      ? this.prevSnapshot.ds
      : Y.emptySnapshot.ds;

    // Create document fragment and render
    const fragmentContent = Y.typeListToArraySnapshot(
      this.historyYXmlFragment,
      new Y.Snapshot(deleteSet, this.snapshot.sv),
    ).map((t) => {
      if (
        !t._item.deleted || isVisible(t._item, this.snapshot) ||
        isVisible(t._item, this.prevSnapshot)
      ) {
        return createNodeFromYElement(
          t,
          state.schema,
          { mapping: new Map(), isOverlappingMark: new Map() },
          this.snapshot,
          this.prevSnapshot,
          computeYChange,
        );
      } else {
        // No need to render elements that are not visible by either snapshot.
        // If a client adds and deletes content in the same snapshot the element is not visible by either snapshot.
        return null;
      }
    }).filter((n) => n !== null);

    return fragmentContent;
  }

  getHistoryDoc(): Y.Doc | undefined {
    return this.historyDoc;
  }
}
