// deno-lint-ignore-file no-window
import * as Y from 'yjs';
import { createMutex, mutex } from 'lib0/mutex';
import * as PModel from 'prosemirror-model';
import {
  AllSelection,
  NodeSelection,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { MarkType, Node } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import * as math from 'lib0/math';
import * as set from 'lib0/set';
import * as error from 'lib0/error';
import * as random from 'lib0/random';
import * as environment from 'lib0/environment';
import * as dom from 'lib0/dom';
import * as eventloop from 'lib0/eventloop';

import { remoteSelectionPluginKey } from '@kerebron/extension-basic-editor/ExtensionRemoteSelection';

import { ySyncPluginKey } from './keys.ts';
import {
  absolutePositionToRelativePosition,
  ProsemirrorMapping,
  relativePositionToAbsolutePosition,
} from './lib.ts';
import {
  createNodeFromYElement,
  createNodeIfNotExists,
  updateYFragment,
} from './updateYFragment.ts';
import {
  type ColorDef,
  isVisible,
  type YSyncPluginState,
} from './ySyncPlugin.ts';

export const defaultColors: Array<ColorDef> = [{
  light: '#ecd44433',
  dark: '#ecd444',
}];

const getUserColor = (
  colorMapping: Map<string, ColorDef>,
  colors: Array<ColorDef>,
  user: string,
): ColorDef => {
  // @todo do not hit the same color twice if possible
  if (!colorMapping.has(user)) {
    if (colorMapping.size < colors.length) {
      const usedColors = set.create();
      colorMapping.forEach((color) => usedColors.add(color));
      colors = colors.filter((color) => !usedColors.has(color));
    }
    colorMapping.set(user, random.oneOf(colors));
  }
  return colorMapping.get(user) || defaultColors[0];
};

export interface BindingMetadata {
  mapping: ProsemirrorMapping;
  isOMark: Map<MarkType, boolean>;
}

interface TransactionSelection {
  type: string;
  anchor: Y.RelativePosition;
  head: Y.RelativePosition;
}

function getSelectionType(selection: Selection) {
  if (selection instanceof TextSelection) {
    return 'text';
  }
  if (selection instanceof AllSelection) {
    return 'all';
  }
  if (selection instanceof NodeSelection) {
    return 'node';
  }
  return 'other_selection';
}

const restoreRelativeSelection = (
  tr: Transaction,
  relSel: ReturnType<typeof getRelativeSelection>,
  binding: ProsemirrorBinding,
) => {
  if (relSel !== null && relSel.anchor !== null && relSel.head !== null) {
    if (relSel.type === 'all') {
      tr.setSelection(new AllSelection(tr.doc));
    } else if (relSel.type === 'node') {
      const anchor = relativePositionToAbsolutePosition(
        binding.ydoc,
        binding.type,
        relSel.anchor,
        binding.mapping,
      );
      if (anchor !== null) {
        tr.setSelection(NodeSelection.create(tr.doc, anchor));
      }
    } else {
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
      if (anchor !== null && head !== null) {
        const sel = TextSelection.between(
          tr.doc.resolve(anchor),
          tr.doc.resolve(head),
        );
        tr.setSelection(sel);
      }
    }
  }
};

export const getRelativeSelection = (
  pmbinding: ProsemirrorBinding,
  state: EditorState,
): TransactionSelection => ({
  type: getSelectionType(state.selection),
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

interface IEditorView {
  state: EditorState;
  dispatch(tr: Transaction): void;
  fake?: boolean;
}

/**
 * Binding for prosemirror.
 *
 * @protected
 */
export class ProsemirrorBinding implements BindingMetadata {
  public ydoc: Y.Doc;
  public isOMark: Map<MarkType, boolean>;
  public type: Y.XmlFragment;
  public readonly mux: mutex;
  public prosemirrorView?: IEditorView;

  private _beforeTransactionSelection: TransactionSelection | null = null;
  private readonly beforeAllTransactions: () => void;
  private readonly afterAllTransactions: () => void;

  private _observeFunction: (event: any, transaction: any) => void;
  private _domSelectionInView: boolean = false;
  get beforeTransactionSelection(): TransactionSelection | null {
    return this._beforeTransactionSelection;
  }
  set beforeTransactionSelection(value: TransactionSelection) {
    this._beforeTransactionSelection = value;
  }

  constructor(
    yXmlFragment: Y.XmlFragment,
    public readonly mapping: ProsemirrorMapping = new Map(),
  ) {
    this.type = yXmlFragment;
    this.prosemirrorView = undefined;
    //   {
    //   state: new EditorState(),
    //   dispatch: () => false,
    //   fake: true
    // };
    this.mux = createMutex();
    /**
     * Is overlapping mark - i.e. mark does not exclude itself.
     */
    this.isOMark = new Map();
    this._observeFunction = (event, transaction) => {
      this.yXmlChanged(event, transaction);
    };
    this.ydoc = yXmlFragment.doc!;
    /**
     * current selection as relative positions in the Yjs model
     */
    this.beforeAllTransactions = () => {
      if (
        !this._beforeTransactionSelection &&
        this.prosemirrorView
      ) {
        this._beforeTransactionSelection = getRelativeSelection(
          this,
          this.prosemirrorView.state,
        );
      }
    };
    this.afterAllTransactions = () => {
      this._beforeTransactionSelection = null;
    };
    this._domSelectionInView = false;
  }

  changeRoom(yXmlFragment: Y.XmlFragment) {
    const view = this.prosemirrorView;
    this.destroy();

    this.type = yXmlFragment;
    this.ydoc = yXmlFragment.doc!;
    this.initView(view);
    // this._forceRerender();
  }

  debug(msg = 'ydoc.prosemirror') {
    console.log(msg, this.type.toString());
  }

  _isLocalCursorInView(): boolean {
    if (!this.prosemirrorView?.hasFocus()) return false;
    if (environment.isBrowser && this._domSelectionInView === false) {
      // Calculate the domSelectionInView and clear by next tick after all events are finished
      eventloop.timeout(0, () => {
        this._domSelectionInView = false;
      });
      this._domSelectionInView = this._isDomSelectionInView();
    }
    return this._domSelectionInView;
  }

  _isDomSelectionInView(): boolean {
    const selection = this.prosemirrorView?.root?.getSelection(); // https://stackoverflow.com/questions/62054839/shadowroot-getselection

    if (!selection || selection.anchorNode == null) return false;

    const range = dom.doc.createRange(); // https://github.com/yjs/y-prosemirror/pull/193
    range.setStart(selection.anchorNode, selection.anchorOffset);
    range.setEnd(selection.focusNode, selection.focusOffset);

    // This is a workaround for an edgecase where getBoundingClientRect will
    // return zero values if the selection is collapsed at the start of a newline
    // see reference here: https://stackoverflow.com/a/59780954
    const rects = range.getClientRects();
    if (rects.length === 0) {
      // probably buggy newline behavior, explicitly select the node contents
      if (range.startContainer && range.collapsed) {
        range.selectNodeContents(range.startContainer);
      }
    }

    const bounding = range.getBoundingClientRect();
    const documentElement = dom.doc.documentElement;

    return bounding.bottom >= 0 && bounding.right >= 0 &&
      bounding.left <=
        (window.innerWidth || documentElement.clientWidth || 0) &&
      bounding.top <= (window.innerHeight || documentElement.clientHeight || 0);
  }

  renderSnapshot(snapshot: Y.Snapshot, prevSnapshot: Y.Snapshot) {
    if (!prevSnapshot) {
      prevSnapshot = Y.createSnapshot(Y.createDeleteSet(), new Map());
    }

    if (!this.prosemirrorView) {
      return;
    }
    const state = this.prosemirrorView.state;

    const tr = state.tr.setMeta('addToHistory', false)
      .setMeta(ySyncPluginKey, { snapshot, prevSnapshot });
    this.prosemirrorView.dispatch(tr);
  }

  unrenderSnapshot() {
    this.mapping.clear();
    this.mux(() => {
      if (!this.prosemirrorView) {
        return;
      }
      const state = this.prosemirrorView.state;
      const children = this.type.toArray();
      const fragmentContent = children.map((t) =>
        createNodeFromYElement(
          t as Y.XmlElement,
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      const _tr = state.tr.setMeta('addToHistory', false);
      const tr = _tr.replace(
        0,
        state.doc.content.size,
        new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
      );
      tr.setMeta(ySyncPluginKey, {
        snapshot: undefined,
        prevSnapshot: undefined,
      });
      if (this.prosemirrorView) {
        this.prosemirrorView.dispatch(tr);
      }
    });
  }

  _forceRerender() {
    this.mapping.clear();
    this.mux(() => {
      if (!this.prosemirrorView) {
        return;
      }
      const state = this.prosemirrorView.state;
      // If this is a forced rerender, this might neither happen as a pm change nor within a Yjs
      // transaction. Then the "before selection" doesn't exist. In this case, we need to create a
      // relative position before replacing content. Fixes #126
      const sel = this._beforeTransactionSelection !== null
        ? null
        : state.selection;
      const fragmentContent = this.type.toArray().map((t) =>
        createNodeFromYElement(
          t as Y.XmlElement,
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      const _tr = state.tr.setMeta('addToHistory', false);
      const tr = _tr.replace(
        0,
        state.doc.content.size,
        new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
      );
      if (sel) {
        /**
         * If the Prosemirror document we just created from this.type is
         * smaller than the previous document, the selection might be
         * out of bound, which would make Prosemirror throw an error.
         */
        const clampedAnchor = math.min(
          math.max(sel.anchor, 0),
          tr.doc.content.size,
        );
        const clampedHead = math.min(
          math.max(sel.head, 0),
          tr.doc.content.size,
        );

        tr.setSelection(
          TextSelection.create(tr.doc, clampedAnchor, clampedHead),
        );
      }
      if (this.prosemirrorView) {
        this.prosemirrorView.dispatch(
          tr.setMeta(ySyncPluginKey, { isChangeOrigin: true, binding: this })
            .setMeta(remoteSelectionPluginKey, { isChangeOrigin: true }),
        );
      }
    });
  }

  _renderSnapshot(
    snapshot: Y.Snapshot | Uint8Array | undefined,
    prevSnapshot: Y.Snapshot | Uint8Array | undefined,
    pluginState: YSyncPluginState,
  ) {
    /**
     * The document that contains the full history of this document.
     */
    let historyDoc = this.ydoc;
    let historyType = this.type;
    if (!snapshot) {
      snapshot = Y.snapshot(this.ydoc);
    }
    if (snapshot instanceof Uint8Array || prevSnapshot instanceof Uint8Array) {
      if (
        !(snapshot instanceof Uint8Array) ||
        !(prevSnapshot instanceof Uint8Array)
      ) {
        // expected both snapshots to be v2 updates
        error.unexpectedCase();
      }
      historyDoc = new Y.Doc({ gc: false });
      Y.applyUpdateV2(historyDoc, prevSnapshot);
      prevSnapshot = Y.snapshot(historyDoc);
      Y.applyUpdateV2(historyDoc, snapshot);
      snapshot = Y.snapshot(historyDoc);
      if (historyType._item === null) {
        /**
         * If is a root type, we need to find the root key in the initial document
         * and use it to get the history type.
         */
        const rootKey = Array.from(this.ydoc.share.keys()).find(
          (key) => this.ydoc.share.get(key) === this.type,
        );
        historyType = historyDoc.getXmlFragment(rootKey);
      } else {
        /**
         * If it is a sub type, we use the item id to find the history type.
         */
        const historyStructs =
          historyDoc.store.clients.get(historyType._item.id.client) ?? [];
        const itemIndex = Y.findIndexSS(
          historyStructs,
          historyType._item.id.clock,
        );
        const item = /** @type {Y.Item} */ (historyStructs[itemIndex]);
        const content = /** @type {Y.ContentType} */ (item.content);
        historyType = /** @type {Y.XmlFragment} */ (content.type);
      }
    }
    // clear mapping because we are going to rerender
    this.mapping.clear();

    this.mux(() => {
      historyDoc.transact((transaction) => {
        if (!this.prosemirrorView) {
          return;
        }
        const state = this.prosemirrorView.state;

        // before rendering, we are going to sanitize ops and split deleted ops
        // if they were deleted by seperate users.
        const pud: Y.PermanentUserData | undefined =
          pluginState.permanentUserData;
        if (pud) {
          pud.dss.forEach((ds) => {
            Y.iterateDeletedStructs(transaction, ds, (_item) => {});
          });
        }
        const computeYChange = (type: 'removed' | 'added', id: Y.ID) => {
          const user = type === 'added'
            ? pud.getUserByClientId(id.client)
            : pud.getUserByDeletedId(id);
          return {
            user,
            type,
            color: getUserColor(
              pluginState.colorMapping,
              pluginState.colors,
              user,
            ),
          };
        };
        // Create document fragment and render
        const fragmentContent = Y.typeListToArraySnapshot(
          historyType,
          new Y.Snapshot(prevSnapshot.ds, snapshot.sv),
        ).map((t) => {
          if (
            !t._item.deleted || isVisible(t._item, snapshot) ||
            isVisible(t._item, prevSnapshot)
          ) {
            return createNodeFromYElement(
              t,
              state.schema,
              { mapping: new Map(), isOMark: new Map() },
              snapshot,
              prevSnapshot,
              computeYChange,
            );
          } else {
            // No need to render elements that are not visible by either snapshot.
            // If a client adds and deletes content in the same snapshot the element is not visible by either snapshot.
            return null;
          }
        }).filter((n) => n !== null);

        const tr = state.tr.setMeta('addToHistory', false);
        tr.replace(
          0,
          state.doc.content.size,
          new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
        );

        tr.setMeta(ySyncPluginKey, { isChangeOrigin: true }),
          this.prosemirrorView.dispatch(tr);
      }, ySyncPluginKey);
    });
  }

  yXmlChanged(events: Array<Y.YEvent<any>>, transaction: Y.Transaction) {
    if (!this.prosemirrorView) {
      return;
    }

    const syncState = ySyncPluginKey.getState(this.prosemirrorView.state)!;
    if (
      events.length === 0 || syncState.snapshot ||
      syncState.prevSnapshot
    ) {
      // drop out if snapshot is active
      this.renderSnapshot(syncState.snapshot, syncState.prevSnapshot);
      return;
    }

    this.mux(() => {
      if (!this.prosemirrorView) {
        return;
      }
      const state = this.prosemirrorView.state;

      const delType = (_: any, type: Y.AbstractType<any>) =>
        this.mapping.delete(type);
      Y.iterateDeletedStructs(
        transaction,
        transaction.deleteSet,
        (struct) => {
          if (struct.constructor === Y.Item) {
            const type: Y.ContentType = (struct as Y.Item).content.type;
            type && this.mapping.delete(type);
          }
        },
      );
      transaction.changed.forEach(delType);
      transaction.changedParentTypes.forEach(delType);

      const fragmentContent = this.type.toArray().map((t) =>
        createNodeIfNotExists(
          t as Y.XmlElement,
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      const tr = state.tr.setMeta('addToHistory', false);
      tr.replace(
        0,
        state.doc.content.size,
        new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
      );
      try {
        if (this._beforeTransactionSelection) {
          restoreRelativeSelection(tr, this._beforeTransactionSelection, this);
        }
      } catch (err) {
        console.warn(err);
      }
      tr.setMeta(ySyncPluginKey, {
        isChangeOrigin: true,
        isUndoRedoOperation: transaction.origin instanceof Y.UndoManager,
      });
      if (
        this._beforeTransactionSelection && this._isLocalCursorInView()
      ) {
        tr.scrollIntoView();
      }
      this.prosemirrorView.dispatch(tr);
    });
  }

  prosemirrorChanged(doc: Node) {
    this.ydoc.transact(() => {
      if (!this.prosemirrorView) {
        throw new Error('Prosemirror changed without view?!');
      }
      updateYFragment(this.ydoc, this.type, doc, this);
      this._beforeTransactionSelection = getRelativeSelection(
        this,
        this.prosemirrorView.state,
      );
    }, ySyncPluginKey);
  }

  /**
   * View is ready to listen to changes. Register observers.
   */
  initView(prosemirrorView?: IEditorView) {
    if (this.prosemirrorView) {
      this.destroy();
    }
    this.prosemirrorView = prosemirrorView;
    this.ydoc.on('beforeAllTransactions', this.beforeAllTransactions);
    this.ydoc.on('afterAllTransactions', this.afterAllTransactions);
    this.type.observeDeep(this._observeFunction);
  }

  destroy() {
    this.type.unobserveDeep(this._observeFunction);
    this.ydoc.off('beforeAllTransactions', this.beforeAllTransactions);
    this.ydoc.off('afterAllTransactions', this.afterAllTransactions);
    if (!this.prosemirrorView) {
      return;
    }
    this.prosemirrorView = undefined;
    //   {
    //   state: new EditorState(),
    //   dispatch: () => false,
    //   fake: true
    // };
  }
}
