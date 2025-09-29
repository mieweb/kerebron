import * as Y from 'yjs';
import { createMutex } from 'lib0/mutex';
import * as PModel from 'prosemirror-model';
import {
  AllSelection,
  NodeSelection,
  Plugin,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { Mark, MarkType, Node, Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import * as math from 'lib0/math';
import * as object from 'lib0/object';
import * as set from 'lib0/set';
import { simpleDiff } from 'lib0/diff';
import * as error from 'lib0/error';
import * as random from 'lib0/random';
import * as environment from 'lib0/environment';
import * as dom from 'lib0/dom';
import * as eventloop from 'lib0/eventloop';
import * as map from 'lib0/map';

import { ySyncPluginKey, yUndoPluginKey } from './keys.ts';
import * as utils from './utils.ts';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from './lib.ts';

export type TransactFunc<T> = (
  f: (arg0?: Y.Transaction) => T,
  origin?: any,
) => T;

export interface BindingMetadata {
  mapping: ProsemirrorMapping;
  isOMark: Map<MarkType, boolean>;
}

export const isVisible = (item: Y.Item, snapshot: Y.Snapshot) =>
  snapshot === undefined
    ? !item.deleted
    : (snapshot.sv.has(item.id.client) && /** @type {number} */
      (snapshot.sv.get(item.id.client)) > item.id.clock &&
      !Y.isDeleted(snapshot.ds, item.id));

type ProsemirrorMapping = Map<
  Y.AbstractType<any>,
  PModel.Node | Array<PModel.Node>
>;

interface ColorDef {
  light: string;
  dark: string;
}

interface YSyncOpts {
  colors?: Array<ColorDef>;
  colorMapping?: Map<string, ColorDef>;
  permanentUserData?: Y.PermanentUserData | null;
  mapping?: ProsemirrorMapping;
  onFirstRender?: Function;
}

const defaultColors: Array<ColorDef> = [{
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
  return colorMapping.get(user);
};

/**
 * This plugin listens to changes in prosemirror view and keeps yXmlState and view in sync.
 *
 * This plugin also keeps references to the type and the shared document so other plugins can access it.
 */
export const ySyncPlugin = (yXmlFragment: Y.XmlFragment, {
  colors = defaultColors,
  colorMapping = new Map(),
  permanentUserData = null,
  onFirstRender = () => {
  },
  mapping,
}: YSyncOpts = {}): any => {
  let initialContentChanged = false;
  const binding = new ProsemirrorBinding(yXmlFragment, mapping);
  const plugin = new Plugin({
    props: {
      editable: (state) => {
        const syncState = ySyncPluginKey.getState(state);
        return syncState.snapshot == null && syncState.prevSnapshot == null;
      },
    },
    key: ySyncPluginKey,
    state: {
      /**
       * @returns {any}
       */
      init: (_initargs, _state) => {
        return {
          type: yXmlFragment,
          doc: yXmlFragment.doc,
          binding,
          snapshot: null,
          prevSnapshot: null,
          isChangeOrigin: false,
          isUndoRedoOperation: false,
          addToHistory: true,
          colors,
          colorMapping,
          permanentUserData,
        };
      },
      apply: (tr, pluginState: PluginState) => {
        const change = tr.getMeta(ySyncPluginKey);
        if (change !== undefined) {
          pluginState = Object.assign({}, pluginState);
          for (const key in change) {
            pluginState[key] = change[key];
          }
        }
        pluginState.addToHistory = tr.getMeta('addToHistory') !== false;
        // always set isChangeOrigin. If undefined, this is not change origin.
        pluginState.isChangeOrigin = change !== undefined &&
          !!change.isChangeOrigin;
        pluginState.isUndoRedoOperation = change !== undefined &&
          !!change.isChangeOrigin && !!change.isUndoRedoOperation;
        if (binding.prosemirrorView !== null) {
          if (
            change !== undefined &&
            (change.snapshot != null || change.prevSnapshot != null)
          ) {
            // snapshot changed, rerender next
            setTimeout(() => {
              if (binding.prosemirrorView == null) {
                return;
              }
              if (change.restore == null) {
                binding._renderSnapshot(
                  change.snapshot,
                  change.prevSnapshot,
                  pluginState,
                );
              } else {
                binding._renderSnapshot(
                  change.snapshot,
                  change.snapshot,
                  pluginState,
                );
                // reset to current prosemirror state
                delete pluginState.restore;
                delete pluginState.snapshot;
                delete pluginState.prevSnapshot;
                binding.mux(() => {
                  binding._prosemirrorChanged(
                    binding.prosemirrorView.state.doc,
                  );
                });
              }
            }, 0);
          }
        }
        return pluginState;
      },
    },
    view: (view) => {
      binding.initView(view);
      if (mapping == null) {
        // force rerender to update the bindings mapping
        binding._forceRerender();
      }
      onFirstRender();
      return {
        update: () => {
          const pluginState = plugin.getState(view.state);
          if (
            pluginState.snapshot == null && pluginState.prevSnapshot == null
          ) {
            if (
              // If the content doesn't change initially, we don't render anything to Yjs
              // If the content was cleared by a user action, we want to catch the change and
              // represent it in Yjs
              initialContentChanged ||
              view.state.doc.content.findDiffStart(
                  view.state.doc.type.createAndFill()!.content,
                ) !== null
            ) {
              initialContentChanged = true;
              if (
                pluginState.addToHistory === false &&
                !pluginState.isChangeOrigin
              ) {
                const yUndoPluginState = yUndoPluginKey.getState(view.state);
                if (yUndoPluginState?.undoManager) {
                  yUndoPluginState.undoManager.stopCapturing();
                }
              }
              binding.mux(() => {
                pluginState.doc.transact((tr) => {
                  tr.meta.set('addToHistory', pluginState.addToHistory);
                  binding._prosemirrorChanged(view.state.doc);
                }, ySyncPluginKey);
              });
            }
          }
        },
        destroy: () => {
          binding.destroy();
        },
      };
    },
  });
  return plugin;
};

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
      tr.setSelection(NodeSelection.create(tr.doc, anchor));
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

interface PluginState {
  addToHistory: boolean;
  isChangeOrigin: boolean;
  restore: any;
  snapshot?: Y.Snapshot;
  prevSnapshot?: Y.Snapshot;
  isUndoRedoOperation: boolean;
  colors: Array<ColorDef>;
  colorMapping: Map<string, ColorDef>;
  permanentUserData: Y.PermanentUserData;
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
  private mux: any;
  public prosemirrorView: EditorView | null;
  private _beforeTransactionSelection: TransactionSelection | null;

  private beforeAllTransactions: () => void;
  private afterAllTransactions: () => void;
  private _observeFunction: (event: any, transaction: any) => void;
  private _domSelectionInView: boolean = false;
  get beforeTransactionSelection(): TransactionSelection {
    return this._beforeTransactionSelection;
  }
  set beforeTransactionSelection(value: TransactionSelection) {
    this._beforeTransactionSelection = value;
  }

  constructor(
    yXmlFragment: Y.XmlFragment,
    public mapping: ProsemirrorMapping = new Map(),
  ) {
    this.type = yXmlFragment;
    this.prosemirrorView = null;
    this.mux = createMutex();
    /**
     * Is overlapping mark - i.e. mark does not exclude itself.
     */
    this.isOMark = new Map();
    this._observeFunction = (event, transaction) =>
      this.yXmlChanged(event, transaction);
    this.ydoc = yXmlFragment.doc!;
    /**
     * current selection as relative positions in the Yjs model
     */
    this._beforeTransactionSelection = null;
    this.beforeAllTransactions = () => {
      if (
        this._beforeTransactionSelection === null &&
        this.prosemirrorView != null
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
    if (this.prosemirrorView) {
      const _tr = this.prosemirrorView.state.tr.setMeta('addToHistory', false);
      this.prosemirrorView.dispatch(
        _tr.setMeta(ySyncPluginKey, { snapshot, prevSnapshot }),
      );
    }
  }

  unrenderSnapshot() {
    this.mapping.clear();
    this.mux(() => {
      if (!this.prosemirrorView) {
        return;
      }
      const state = this.prosemirrorView.state;
      const fragmentContent = this.type.toArray().map((t: Y.XmlElement) =>
        createNodeFromYElement(
          t,
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      // @ts-ignore
      const _tr = state.tr.setMeta('addToHistory', false);
      const tr = _tr.replace(
        0,
        state.doc.content.size,
        new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
      );
      tr.setMeta(ySyncPluginKey, { snapshot: null, prevSnapshot: null });
      this.prosemirrorView.dispatch(tr);
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
          /** @type {Y.XmlElement} */ (t),
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      // @ts-ignore
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
      this.prosemirrorView.dispatch(
        tr.setMeta(ySyncPluginKey, { isChangeOrigin: true, binding: this }),
      );
    });
  }

  _renderSnapshot(
    snapshot: Y.Snapshot | Uint8Array,
    prevSnapshot: Y.Snapshot | Uint8Array,
    pluginState: PluginState,
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
        // before rendering, we are going to sanitize ops and split deleted ops
        // if they were deleted by seperate users.
        /**
         * @type {Y.PermanentUserData}
         */
        const pud = pluginState.permanentUserData;
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
              this.prosemirrorView.state.schema,
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
        const _tr = this.prosemirrorView.state.tr.setMeta(
          'addToHistory',
          false,
        );
        const tr = _tr.replace(
          0,
          this.prosemirrorView.state.doc.content.size,
          new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
        );
        this.prosemirrorView.dispatch(
          tr.setMeta(ySyncPluginKey, { isChangeOrigin: true }),
        );
      }, ySyncPluginKey);
    });
  }

  yXmlChanged(events: Array<Y.YEvent<any>>, transaction: Y.Transaction) {
    if (this.prosemirrorView == null) return;
    const syncState = ySyncPluginKey.getState(this.prosemirrorView.state);
    if (
      events.length === 0 || syncState.snapshot != null ||
      syncState.prevSnapshot != null
    ) {
      // drop out if snapshot is active
      this.renderSnapshot(syncState.snapshot, syncState.prevSnapshot);
      return;
    }
    this.mux(() => {
      const delType = (_, type: Y.AbstractType<any>) =>
        this.mapping.delete(type);
      Y.iterateDeletedStructs(
        transaction,
        transaction.deleteSet,
        (struct) => {
          if (struct.constructor === Y.Item) {
            const type =
              /** @type {Y.ContentType} */ (/** @type {Y.Item} */ (struct)
                .content).type;
            type && this.mapping.delete(type);
          }
        },
      );
      transaction.changed.forEach(delType);
      transaction.changedParentTypes.forEach(delType);

      if (!this.prosemirrorView) {
        return;
      }
      const state = this.prosemirrorView.state;

      const fragmentContent = this.type.toArray().map((t) =>
        createNodeIfNotExists(
          /** @type {Y.XmlElement | Y.XmlHook} */ (t),
          state.schema,
          this,
        )
      ).filter((n) => n !== null);
      const _tr = state.tr.setMeta('addToHistory', false);
      let tr = _tr.replace(
        0,
        state.doc.content.size,
        new PModel.Slice(PModel.Fragment.from(fragmentContent), 0, 0),
      );
      try {
        restoreRelativeSelection(tr, this._beforeTransactionSelection, this);
      } catch (err) {
        console.warn(err);
      }
      tr = tr.setMeta(ySyncPluginKey, {
        isChangeOrigin: true,
        isUndoRedoOperation: transaction.origin instanceof Y.UndoManager,
      });
      if (
        this._beforeTransactionSelection !== null && this._isLocalCursorInView()
      ) {
        tr.scrollIntoView();
      }
      this.prosemirrorView.dispatch(tr);
    });
  }

  _prosemirrorChanged(doc: Node) {
    this.ydoc.transact(() => {
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
  initView(prosemirrorView: any) {
    if (this.prosemirrorView != null) this.destroy();
    this.prosemirrorView = prosemirrorView;
    this.ydoc.on('beforeAllTransactions', this.beforeAllTransactions);
    this.ydoc.on('afterAllTransactions', this.afterAllTransactions);
    this.type.observeDeep(this._observeFunction);
  }

  destroy() {
    if (this.prosemirrorView == null) return;
    this.prosemirrorView = null;
    this.type.unobserveDeep(this._observeFunction);
    this.ydoc.off('beforeAllTransactions', this.beforeAllTransactions);
    this.ydoc.off('afterAllTransactions', this.afterAllTransactions);
  }
}

const createNodeIfNotExists = (
  el: Y.XmlElement | Y.XmlHook,
  schema: PModel.Schema,
  meta: BindingMetadata,
  snapshot?: Y.Snapshot,
  prevSnapshot?: Y.Snapshot,
  computeYChange?: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): PModel.Node | null => {
  const node: PModel.Node = meta.mapping.get(el);
  if (node === undefined) {
    if (el instanceof Y.XmlElement) {
      return createNodeFromYElement(
        el,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
    } else {
      throw error.methodUnimplemented(); // we are currently not handling hooks
    }
  }
  return node;
};

export const createNodeFromYElement = (
  el: Y.XmlElement,
  schema: any,
  meta: BindingMetadata,
  snapshot?: Y.Snapshot,
  prevSnapshot?: Y.Snapshot,
  computeYChange?: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): PModel.Node | null => {
  const children: PModel.Node[] = [];
  const createChildren = (type: Y.XmlElement | Y.XmlText) => {
    if (type instanceof Y.XmlElement) {
      const n = createNodeIfNotExists(
        type,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
      if (n !== null) {
        children.push(n);
      }
    } else {
      // If the next ytext exists and was created by us, move the content to the current ytext.
      // This is a fix for #160 -- duplication of characters when two Y.Text exist next to each
      // other.
      const nextytext = /** @type {Y.ContentType} */ (type._item.right?.content)
        ?.type;
      if (
        nextytext instanceof Y.Text && !nextytext._item.deleted &&
        nextytext._item.id.client === nextytext.doc.clientID
      ) {
        type.applyDelta([
          { retain: type.length },
          ...nextytext.toDelta(),
        ]);
        nextytext.doc.transact((tr) => {
          nextytext._item.delete(tr);
        });
      }
      // now create the prosemirror text nodes
      const ns = createTextNodesFromYText(
        type,
        schema,
        meta,
        snapshot,
        prevSnapshot,
        computeYChange,
      );
      if (ns !== null) {
        ns.forEach((textchild) => {
          if (textchild !== null) {
            children.push(textchild);
          }
        });
      }
    }
  };
  if (snapshot === undefined || prevSnapshot === undefined) {
    el.toArray().forEach(createChildren);
  } else {
    Y.typeListToArraySnapshot(el, new Y.Snapshot(prevSnapshot.ds, snapshot.sv))
      .forEach(createChildren);
  }
  try {
    const attrs = el.getAttributes(snapshot);
    if (snapshot !== undefined) {
      if (!isVisible(/** @type {Y.Item} */ (el._item), snapshot)) {
        attrs.ychange = computeYChange
          ? computeYChange('removed', /** @type {Y.Item} */ (el._item).id)
          : { type: 'removed' };
      } else if (!isVisible(/** @type {Y.Item} */ (el._item), prevSnapshot)) {
        attrs.ychange = computeYChange
          ? computeYChange('added', /** @type {Y.Item} */ (el._item).id)
          : { type: 'added' };
      }
    }
    const node = schema.node(el.nodeName, attrs, children);
    meta.mapping.set(el, node);
    return node;
  } catch (e) {
    // an error occured while creating the node. This is probably a result of a concurrent action.
    /** @type {Y.Doc} */ (el.doc).transact((transaction) => {
      /** @type {Y.Item} */ (el._item).delete(transaction);
    }, ySyncPluginKey);
    meta.mapping.delete(el);
    return null;
  }
};

/**
 * @private
 */
const createTextNodesFromYText = (
  text: Y.XmlText,
  schema: import('prosemirror-model').Schema,
  _meta: BindingMetadata,
  snapshot: Y.Snapshot,
  prevSnapshot: Y.Snapshot,
  computeYChange: (arg0: 'removed' | 'added', arg1: Y.ID) => any,
): Array<PModel.Node> | null => {
  const nodes = [];
  const deltas = text.toDelta(snapshot, prevSnapshot, computeYChange);
  try {
    for (let i = 0; i < deltas.length; i++) {
      const delta = deltas[i];
      nodes.push(
        schema.text(delta.insert, attributesToMarks(delta.attributes, schema)),
      );
    }
  } catch (e) {
    // an error occured while creating the node. This is probably a result of a concurrent action.
    /** @type {Y.Doc} */ (text.doc).transact((transaction) => {
      /** @type {Y.Item} */ (text._item).delete(transaction);
    }, ySyncPluginKey);
    return null;
  }
  // @ts-ignore
  return nodes;
};

/**
 * @private
 */
const createTypeFromTextNodes = (
  nodes: Array<any>,
  meta: BindingMetadata,
): Y.XmlText => {
  const type = new Y.XmlText();
  const delta = nodes.map((node) => ({
    // @ts-ignore
    insert: node.text,
    attributes: marksToAttributes(node.marks, meta),
  }));
  type.applyDelta(delta);
  meta.mapping.set(type, nodes);
  return type;
};

/**
 * @private
 */
const createTypeFromElementNode = (
  node: any,
  meta: BindingMetadata,
): Y.XmlElement => {
  const type = new Y.XmlElement(node.type.name);
  for (const key in node.attrs) {
    const val = node.attrs[key];
    if (val !== null && key !== 'ychange') {
      type.setAttribute(key, val);
    }
  }
  type.insert(
    0,
    normalizePNodeContent(node).map((n) =>
      createTypeFromTextOrElementNode(n, meta)
    ),
  );
  meta.mapping.set(type, node);
  return type;
};

/**
 * @private
 */
const createTypeFromTextOrElementNode = (
  node: PModel.Node | Array<PModel.Node>,
  meta: BindingMetadata,
): Y.XmlElement | Y.XmlText =>
  node instanceof Array
    ? createTypeFromTextNodes(node, meta)
    : createTypeFromElementNode(node, meta);

const isObject = (val: any) => typeof val === 'object' && val !== null;

const equalAttrs = (pattrs: any, yattrs: any) => {
  const keys = Object.keys(pattrs).filter((key) => pattrs[key] !== null);
  let eq = keys.length ===
    (yattrs == null
      ? 0
      : Object.keys(yattrs).filter((key) => yattrs[key] !== null).length);
  for (let i = 0; i < keys.length && eq; i++) {
    const key = keys[i];
    const l = pattrs[key];
    const r = yattrs[key];
    eq = key === 'ychange' || l === r ||
      (isObject(l) && isObject(r) && equalAttrs(l, r));
  }
  return eq;
};

type NormalizedPNodeContent = Array<Array<PModel.Node> | PModel.Node>;

const normalizePNodeContent = (pnode: any): NormalizedPNodeContent => {
  const c = pnode.content.content;
  const res = [];
  for (let i = 0; i < c.length; i++) {
    const n = c[i];
    if (n.isText) {
      const textNodes = [];
      for (let tnode = c[i]; i < c.length && tnode.isText; tnode = c[++i]) {
        textNodes.push(tnode);
      }
      i--;
      res.push(textNodes);
    } else {
      res.push(n);
    }
  }
  return res;
};

const equalYTextPText = (ytext: Y.XmlText, ptexts: Array<any>) => {
  const delta = ytext.toDelta();
  return delta.length === ptexts.length &&
    delta.every((d: any, i: number): boolean =>
      d.insert === /** @type {any} */ (ptexts[i]).text &&
      object.keys(d.attributes || {}).length === ptexts[i].marks.length &&
      object.every(d.attributes, (attr, yattrname) => {
        const markname = yattr2markname(yattrname);
        const pmarks = ptexts[i].marks;
        return equalAttrs(
          attr,
          pmarks.find((mark: Mark) => mark.type.name === markname)?.attrs,
        );
      })
    );
};

const equalYTypePNode = (
  ytype: Y.XmlElement | Y.XmlText | Y.XmlHook,
  pnode: any | Array<any>,
) => {
  if (
    ytype instanceof Y.XmlElement && !(pnode instanceof Array) &&
    matchNodeName(ytype, pnode)
  ) {
    const normalizedContent = normalizePNodeContent(pnode);
    return ytype._length === normalizedContent.length &&
      equalAttrs(ytype.getAttributes(), pnode.attrs) &&
      ytype.toArray().every((ychild, i) =>
        equalYTypePNode(ychild, normalizedContent[i])
      );
  }
  return ytype instanceof Y.XmlText && pnode instanceof Array &&
    equalYTextPText(ytype, pnode);
};

const mappedIdentity = (
  mapped: PModel.Node | Array<PModel.Node> | undefined,
  pcontent: PModel.Node | Array<PModel.Node>,
) =>
  mapped === pcontent ||
  (mapped instanceof Array && pcontent instanceof Array &&
    mapped.length === pcontent.length &&
    mapped.every((a, i) => pcontent[i] === a));

const computeChildEqualityFactor = (
  ytype: Y.XmlElement,
  pnode: PModel.Node,
  meta: BindingMetadata,
): { foundMappedChild: boolean; equalityFactor: number } => {
  const yChildren = ytype.toArray();
  const pChildren = normalizePNodeContent(pnode);
  const pChildCnt = pChildren.length;
  const yChildCnt = yChildren.length;
  const minCnt = math.min(yChildCnt, pChildCnt);
  let left = 0;
  let right = 0;
  let foundMappedChild = false;
  for (; left < minCnt; left++) {
    const leftY = yChildren[left];
    const leftP = pChildren[left];
    if (mappedIdentity(meta.mapping.get(leftY), leftP)) {
      foundMappedChild = true; // definite (good) match!
    } else if (!equalYTypePNode(leftY, leftP)) {
      break;
    }
  }
  for (; left + right < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1];
    const rightP = pChildren[pChildCnt - right - 1];
    if (mappedIdentity(meta.mapping.get(rightY), rightP)) {
      foundMappedChild = true;
    } else if (!equalYTypePNode(rightY, rightP)) {
      break;
    }
  }
  return {
    equalityFactor: left + right,
    foundMappedChild,
  };
};

const ytextTrans = (ytext: Y.Text) => {
  let str = '';
  let n: Y.Item | null = ytext._start;
  const nAttrs: Record<string, null> = {};
  while (n !== null) {
    if (!n.deleted) {
      if (n.countable && n.content instanceof Y.ContentString) {
        str += n.content.str;
      } else if (n.content instanceof Y.ContentFormat) {
        nAttrs[n.content.key] = null;
      }
    }
    n = n.right;
  }
  return {
    str,
    nAttrs,
  };
};

/**
 * @todo test this more
 */
const updateYText = (
  ytext: Y.Text,
  ptexts: Array<any>,
  meta: BindingMetadata,
) => {
  meta.mapping.set(ytext, ptexts);
  const { nAttrs, str } = ytextTrans(ytext);
  const content = ptexts.map((p) => ({
    insert: /** @type {any} */ (p).text,
    attributes: Object.assign({}, nAttrs, marksToAttributes(p.marks, meta)),
  }));
  const { insert, remove, index } = simpleDiff(
    str,
    content.map((c) => c.insert).join(''),
  );
  ytext.delete(index, remove);
  ytext.insert(index, insert);
  ytext.applyDelta(
    content.map((c) => ({ retain: c.insert.length, attributes: c.attributes })),
  );
};

const hashedMarkNameRegex = /(.*)(--[a-zA-Z0-9+/=]{8})$/;
export const yattr2markname = (attrName: string) =>
  hashedMarkNameRegex.exec(attrName)?.[1] ?? attrName;

/**
 * @todo move this to markstoattributes
 */
export const attributesToMarks = (
  attrs: { [s: string]: any },
  schema: Schema,
) => {
  const marks: Array<Mark> = [];
  for (const markName in attrs) {
    // remove hashes if necessary
    marks.push(schema.mark(yattr2markname(markName), attrs[markName]));
  }
  return marks;
};

const marksToAttributes = (
  marks: Array<Mark>,
  meta: BindingMetadata,
): Record<string, PModel.Attrs> => {
  const pattrs: Record<string, PModel.Attrs> = {};
  marks.forEach((mark) => {
    if (mark.type.name !== 'ychange') {
      const isOverlapping = map.setIfUndefined(
        meta.isOMark,
        mark.type,
        () => !mark.type.excludes(mark.type),
      );
      pattrs[
        isOverlapping
          ? `${mark.type.name}--${utils.hashOfJSON(mark.toJSON())}`
          : mark.type.name
      ] = mark.attrs;
    }
  });
  return pattrs;
};

/**
 * Update a yDom node by syncing the current content of the prosemirror node.
 *
 * This is a y-prosemirror internal feature that you can use at your own risk.
 *
 * @private
 * @unstable
 */
export const updateYFragment = (
  y: { transact: TransactFunc<void> },
  yDomFragment: Y.XmlFragment,
  pNode: Node,
  meta: BindingMetadata,
) => {
  if (
    yDomFragment instanceof Y.XmlElement &&
    yDomFragment.nodeName !== pNode.type.name
  ) {
    throw new Error('node name mismatch!');
  }
  meta.mapping.set(yDomFragment, pNode);
  // update attributes
  if (yDomFragment instanceof Y.XmlElement) {
    const yDomAttrs = yDomFragment.getAttributes();
    const pAttrs = pNode.attrs;
    for (const key in pAttrs) {
      if (pAttrs[key] !== null) {
        if (yDomAttrs[key] !== pAttrs[key] && key !== 'ychange') {
          yDomFragment.setAttribute(key, pAttrs[key]);
        }
      } else {
        yDomFragment.removeAttribute(key);
      }
    }
    // remove all keys that are no longer in pAttrs
    for (const key in yDomAttrs) {
      if (pAttrs[key] === undefined) {
        yDomFragment.removeAttribute(key);
      }
    }
  }
  // update children
  const pChildren = normalizePNodeContent(pNode);
  const pChildCnt = pChildren.length;
  const yChildren = yDomFragment.toArray();
  const yChildCnt = yChildren.length;
  const minCnt = math.min(pChildCnt, yChildCnt);
  let left = 0;
  let right = 0;
  // find number of matching elements from left
  for (; left < minCnt; left++) {
    const leftY = yChildren[left];
    const leftP = pChildren[left];
    if (!mappedIdentity(meta.mapping.get(leftY), leftP)) {
      if (equalYTypePNode(leftY, leftP)) {
        // update mapping
        meta.mapping.set(leftY, leftP);
      } else {
        break;
      }
    }
  }
  // find number of matching elements from right
  for (; right + left < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1];
    const rightP = pChildren[pChildCnt - right - 1];
    if (!mappedIdentity(meta.mapping.get(rightY), rightP)) {
      if (equalYTypePNode(rightY, rightP)) {
        // update mapping
        meta.mapping.set(rightY, rightP);
      } else {
        break;
      }
    }
  }
  y.transact(() => {
    // try to compare and update
    while (yChildCnt - left - right > 0 && pChildCnt - left - right > 0) {
      const leftY: Y.XmlElement = yChildren[left];
      const leftP: PModel.Node = pChildren[left];
      const rightY: Y.XmlElement = yChildren[yChildCnt - right - 1];
      const rightP: PModel.Node = pChildren[pChildCnt - right - 1];
      if (leftY instanceof Y.XmlText && leftP instanceof Array) {
        if (!equalYTextPText(leftY, leftP)) {
          updateYText(leftY, leftP, meta);
        }
        left += 1;
      } else {
        let updateLeft = leftY instanceof Y.XmlElement &&
          matchNodeName(leftY, leftP);
        let updateRight = rightY instanceof Y.XmlElement &&
          matchNodeName(rightY, rightP);
        if (updateLeft && updateRight) {
          // decide which element to update
          const equalityLeft = computeChildEqualityFactor(
            leftY,
            leftP,
            meta,
          );
          const equalityRight = computeChildEqualityFactor(
            rightY,
            rightP,
            meta,
          );
          if (
            equalityLeft.foundMappedChild && !equalityRight.foundMappedChild
          ) {
            updateRight = false;
          } else if (
            !equalityLeft.foundMappedChild && equalityRight.foundMappedChild
          ) {
            updateLeft = false;
          } else if (
            equalityLeft.equalityFactor < equalityRight.equalityFactor
          ) {
            updateLeft = false;
          } else {
            updateRight = false;
          }
        }
        if (updateLeft) {
          updateYFragment(
            y,
            /** @type {Y.XmlFragment} */ (leftY),
            /** @type {PModel.Node} */ (leftP),
            meta,
          );
          left += 1;
        } else if (updateRight) {
          updateYFragment(
            y,
            /** @type {Y.XmlFragment} */ (rightY),
            /** @type {PModel.Node} */ (rightP),
            meta,
          );
          right += 1;
        } else {
          meta.mapping.delete(yDomFragment.get(left));
          yDomFragment.delete(left, 1);
          yDomFragment.insert(left, [
            createTypeFromTextOrElementNode(leftP, meta),
          ]);
          left += 1;
        }
      }
    }
    const yDelLen = yChildCnt - left - right;
    if (
      yChildCnt === 1 && pChildCnt === 0 && yChildren[0] instanceof Y.XmlText
    ) {
      meta.mapping.delete(yChildren[0]);
      // Edge case handling https://github.com/yjs/y-prosemirror/issues/108
      // Only delete the content of the Y.Text to retain remote changes on the same Y.Text object
      yChildren[0].delete(0, yChildren[0].length);
    } else if (yDelLen > 0) {
      yDomFragment.slice(left, left + yDelLen).forEach((type) =>
        meta.mapping.delete(type)
      );
      yDomFragment.delete(left, yDelLen);
    }
    if (left + right < pChildCnt) {
      const ins = [];
      for (let i = left; i < pChildCnt - right; i++) {
        ins.push(createTypeFromTextOrElementNode(pChildren[i], meta));
      }
      yDomFragment.insert(left, ins);
    }
  }, ySyncPluginKey);
};

const matchNodeName = (yElement: Y.XmlElement, pNode: any) =>
  !(pNode instanceof Array) && yElement.nodeName === pNode.type.name;
