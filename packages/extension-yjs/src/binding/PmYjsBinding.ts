import * as Y from 'yjs';

import { Fragment, Slice } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { User } from '@kerebron/editor/user';

import { CreateYjsProvider, YjsProvider } from '../YjsProvider.ts';
import { ProsemirrorMapping } from '../lib.ts';
import { SelectionStash } from '../ui/selection.ts';
import { ySyncPluginKey } from '../keys.ts';

import { yXmlFragmentToProseMirrorRootNode } from './convertUtils.ts';
import { updateYFragment } from './updateYFragment.ts';
import { BindingMetadata } from './BindingMetadata.ts';
import { createNodeIfNotExists } from './createNodeFromYElement.ts';
import { DiffViewer } from './DiffViewer.ts';

type Mutex = (f: () => void, g?: () => void) => void;

export const createMutex = (): Mutex => {
  let token = true;
  return (f: () => void, g?: () => void) => {
    if (token) {
      token = false;
      try {
        f();
      } finally {
        token = true;
      }
    } else if (g !== undefined) {
      g();
    }
  };
};

type ConnectionState = 'idle' | 'joining' | 'synced' | 'leaving' | 'error';

export type YjsData = { ydoc: Y.Doc; xmlFragment: Y.XmlFragment };

export class PmYjsBinding extends EventTarget {
  private provider: YjsProvider | undefined;
  private connectionState: ConnectionState = 'idle';

  private yjs: YjsData | undefined;
  private selectionStash: SelectionStash | undefined;
  public readonly diffViewer: DiffViewer;

  public addToYjsHistory = true;
  private hasImported = false;
  private mux: Mutex;
  private bindingMetadata: BindingMetadata;

  private syncedHandler: (
    event: CustomEvent<{
      state: boolean;
    }>,
  ) => void;
  private _observeFunction: (
    events: Array<Y.YEvent<any>>,
    transaction: Y.Transaction,
  ) => void;
  private permanentUserData: Y.PermanentUserData | undefined;
  private user: User | undefined;

  constructor(private readonly editor: CoreEditor) {
    super();

    this.diffViewer = new DiffViewer();
    this.bindingMetadata = { mapping: new Map(), isOverlappingMark: new Map() };

    this.mux = createMutex();

    this.syncedHandler = (
      event: CustomEvent<{
        state: boolean;
      }>,
    ) => {
      const synced = event.detail.state;
      if (synced && !this.hasImported) {
        this.importRemoteYdoc();
      } else {
        // this.ydocChanged();
      }
    };

    this._observeFunction = (events, transaction) => {
      this.yXmlChanged(events, transaction);
    };
  }

  destroy() {
    this.connectionState = 'idle';
    const tr = this.editor.state.tr;
    this.leaveRoom(tr);
    this.editor.dispatchTransaction(tr);
    this.diffViewer.reset();
    this.selectionStash?.destroy();
  }

  changeUser(user: User) {
    this.user = user;
    if (!this.provider) {
      return;
    }

    if (this.yjs && user.id) {
      const { ydoc } = this.yjs;
      this.permanentUserData = new Y.PermanentUserData(ydoc);
      this.permanentUserData.setUserMapping(ydoc, ydoc.clientID, user.id);
    }

    this.provider.awareness.setLocalStateField('kerebron:user', user);
  }

  changeRoom(
    roomId: string,
    createYjsProvider: CreateYjsProvider,
    tr: Transaction,
  ) {
    this.connectionState = 'joining';
    this.hasImported = false;

    if (this.provider) {
      this.provider.removeEventListener('synced', this.syncedHandler);
      this.provider.destroy();
      this.provider = undefined;
    }

    const [provider, ydoc] = createYjsProvider(
      roomId,
    );

    this.addToYjsHistory = true;
    this.provider = provider;

    this.bindingMetadata.mapping.clear();
    this.bindingMetadata.isOverlappingMark.clear();
    this.diffViewer.reset();

    const fieldName = 'kerebron:' + this.editor.schema.topNodeType.name;
    this.yjs = { ydoc, xmlFragment: ydoc.getXmlFragment(fieldName) };
    this.permanentUserData = new Y.PermanentUserData(ydoc);
    if (this.user?.id) {
      this.permanentUserData.setUserMapping(ydoc, ydoc.clientID, this.user.id);
    }

    this.selectionStash = new SelectionStash(
      this.yjs,
      this.getMapping(),
      this.editor,
    );
    this.yjs.xmlFragment.observeDeep(this._observeFunction);

    this.provider.addEventListener('synced', this.syncedHandler);

    tr.setMeta('yjs:setAwareness', provider.awareness);
    tr.setMeta('setYjs', this.yjs);
  }

  leaveRoom(tr: Transaction) {
    this.connectionState = 'leaving';
    if (this.provider) {
      this.provider.removeEventListener('synced', this.syncedHandler);
      this.provider.destroy();
    }

    this.addToYjsHistory = true;
    this.provider = undefined;

    this.bindingMetadata.mapping.clear();
    this.bindingMetadata.isOverlappingMark.clear();
    this.diffViewer.reset();

    this.selectionStash?.destroy();
    this.selectionStash = undefined;
    this.yjs?.xmlFragment.unobserveDeep(this._observeFunction);
    this.yjs = undefined;
    this.permanentUserData = undefined;

    this.hasImported = false;

    tr.setMeta('addToYjsHistory', false);
    tr.setMeta('yjs:removeAwareness', true);
    tr.setMeta('clearYjs', true);
  }

  importRemoteYdoc() {
    if (!this.yjs) {
      return;
    }
    if (this.diffViewer.isActive()) {
      return;
    }

    this.addToYjsHistory = this.editor.state.doc.content.size > 2; // Non empty para

    if (this.yjs.xmlFragment.length === 0) {
      this.createFromProseMirror(this.yjs);
    } else {
      this.overwriteProseMirror(this.yjs.xmlFragment);
    }

    this.connectionState = 'synced';
    this.hasImported = true;
  }

  yXmlChanged(events: Array<Y.YEvent<any>>, ytr: Y.Transaction) {
    this.mux(() => {
      if (!this.yjs) {
        return;
      }

      if (this.diffViewer.isActive()) {
        return;
      }

      const state = this.editor.state;

      const { xmlFragment } = this.yjs;

      const mapping = this.bindingMetadata.mapping;
      const delType = (_: any, type: Y.AbstractType<any>) =>
        mapping.delete(type);
      Y.iterateDeletedStructs(
        ytr,
        ytr.deleteSet,
        (struct) => {
          if (struct.constructor === Y.Item) {
            const type = (struct as Y.Item).content.type;
            type && mapping.delete(type);
          }
        },
      );
      ytr.changed.forEach(delType);
      ytr.changedParentTypes.forEach(delType);

      const fragmentContent = xmlFragment.toArray().map((t) =>
        createNodeIfNotExists(
          t as Y.XmlElement,
          state.schema,
          this.bindingMetadata,
        )
      ).filter((n) => n !== null);

      const tr = state.tr;
      tr.setMeta('addToYjsHistory', false);
      tr.replace(
        0,
        state.doc.content.size,
        new Slice(Fragment.from(fragmentContent), 0, 0),
      );

      this.selectionStash?.restore(tr);
      this.editor.dispatchTransaction(tr);
    });
  }

  pmChanged() {
    if (!this.hasImported) {
      return;
    }

    if (!this.yjs) {
      return;
    }

    if (this.diffViewer.isActive()) {
      return;
    }

    const doc = this.editor.state.doc;
    const { ydoc, xmlFragment } = this.yjs;

    this.mux(() => {
      const origin = ySyncPluginKey;

      ydoc.transact((ytr) => {
        ytr.meta.set('addToYjsHistory', this.addToYjsHistory);
        updateYFragment(
          ydoc,
          xmlFragment,
          doc,
          this.bindingMetadata,
          this.addToYjsHistory,
        );
        this.selectionStash?.store();
      }, origin);
    });
  }

  createFromProseMirror(yjs: YjsData) {
    const doc = this.editor.state.doc;
    const { ydoc, xmlFragment } = yjs;
    updateYFragment(
      ydoc,
      xmlFragment,
      doc,
      this.bindingMetadata,
      this.addToYjsHistory,
    );
  }

  overwriteProseMirror(yXmlFragment: Y.XmlFragment) {
    const state = this.editor.state;
    const newRoot = yXmlFragmentToProseMirrorRootNode(
      yXmlFragment,
      state.schema,
    );

    const tr = state.tr;
    tr.setMeta('addToYjsHistory', false);
    tr.replaceWith(
      0,
      state.doc.content.size,
      newRoot,
    );

    this.editor.dispatchTransaction(tr);
  }

  getYjs(): YjsData | undefined {
    return this.yjs;
  }

  getMapping(): ProsemirrorMapping {
    return this.bindingMetadata.mapping;
  }

  getSelectionStash(): SelectionStash | undefined {
    return this.selectionStash;
  }

  isEditable() {
    return !this.diffViewer.isActive();
  }

  setSnapshot(
    snapshot: Uint8Array<ArrayBufferLike>,
    prevSnapshot: Uint8Array<ArrayBufferLike> | undefined,
  ) {
    if (!this.yjs) {
      return;
    }
    this.diffViewer.setSnapshot(this.yjs, snapshot, prevSnapshot);

    // clear mapping because we are going to rerender
    this.bindingMetadata.mapping.clear();
    this.bindingMetadata.isOverlappingMark.clear();

    this.mux(() => {
      const historyDoc = this.diffViewer.getHistoryDoc();
      if (!historyDoc) {
        return;
      }

      historyDoc.transact((ytr) => {
        const state = this.editor.state;
        const fragmentContent = this.diffViewer.getFragmentContent(
          state,
          ytr,
          this.permanentUserData,
        );

        if (!fragmentContent) {
          return;
        }

        const tr = state.tr;
        tr.replace(
          0,
          state.doc.content.size,
          new Slice(Fragment.from(fragmentContent), 0, 0),
        );

        tr.setMeta('addToHistory', false);
        tr.setMeta(ySyncPluginKey, { isChangeOrigin: true }),
          this.editor.dispatchTransaction(tr);
      }, ySyncPluginKey);
    });
  }
}
