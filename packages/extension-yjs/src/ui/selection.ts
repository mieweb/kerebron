import * as Y from 'yjs';

import {
  AllSelection,
  EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';

import { YjsData } from '../binding/PmYjsBinding.ts';
import { ProsemirrorMapping } from '../lib.ts';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from '../position.ts';
import { CoreEditor } from '@kerebron/editor';

interface TransactionSelection {
  type: string;
  anchor: Y.RelativePosition;
  head: Y.RelativePosition;
}

const restoreRelativeSelection = (
  tr: Transaction,
  relSel: ReturnType<typeof getRelativeSelection>,
  yjs: YjsData,
  mapping: ProsemirrorMapping,
) => {
  const { ydoc, xmlFragment } = yjs;

  if (relSel !== null && relSel.anchor !== null && relSel.head !== null) {
    if (relSel.type === 'all') {
      tr.setSelection(new AllSelection(tr.doc));
    } else if (relSel.type === 'node') {
      const anchor = relativePositionToAbsolutePosition(
        ydoc,
        xmlFragment,
        relSel.anchor,
        mapping,
      );
      if (anchor !== null) {
        tr.setSelection(NodeSelection.create(tr.doc, anchor));
      }
    } else {
      const anchor = relativePositionToAbsolutePosition(
        ydoc,
        xmlFragment,
        relSel.anchor,
        mapping,
      );
      const head = relativePositionToAbsolutePosition(
        ydoc,
        xmlFragment,
        relSel.head,
        mapping,
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
  xmlFragment: Y.XmlFragment,
  mapping: ProsemirrorMapping,
  state: EditorState,
): TransactionSelection => ({
  type: getSelectionType(state.selection),
  anchor: absolutePositionToRelativePosition(
    state.selection.anchor,
    xmlFragment,
    mapping,
  ),
  head: absolutePositionToRelativePosition(
    state.selection.head,
    xmlFragment,
    mapping,
  ),
});

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

export class SelectionStash {
  private readonly beforeAllTransactions: () => void;
  private readonly afterAllTransactions: () => void;

  private _beforeTransactionSelection: TransactionSelection | null = null;
  private _domSelectionInView: boolean = false;

  constructor(
    private yjs: YjsData,
    private mapping: ProsemirrorMapping,
    private editor: CoreEditor,
  ) {
    this.beforeAllTransactions = () => {
      if (
        !this._beforeTransactionSelection &&
        editor.view
      ) {
        this._beforeTransactionSelection = getRelativeSelection(
          yjs.xmlFragment,
          mapping,
          editor.state,
        );
      }
    };
    this.afterAllTransactions = () => {
      this._beforeTransactionSelection = null;
    };

    this.yjs.ydoc.on('beforeAllTransactions', this.beforeAllTransactions);
    this.yjs.ydoc.on('afterAllTransactions', this.afterAllTransactions);
  }

  destroy() {
    this.yjs.ydoc.off('beforeAllTransactions', this.beforeAllTransactions);
    this.yjs.ydoc.off('afterAllTransactions', this.afterAllTransactions);
  }

  store() {
    this._beforeTransactionSelection = getRelativeSelection(
      this.yjs.xmlFragment,
      this.mapping,
      this.editor.state,
    );
  }

  overwrite(transactionSelection: TransactionSelection) {
    this._beforeTransactionSelection = transactionSelection;
  }

  restore(tr: Transaction) {
    if (this._beforeTransactionSelection) {
      restoreRelativeSelection(
        tr,
        this._beforeTransactionSelection,
        this.yjs,
        this.mapping,
      );
      if (this._isLocalCursorInView()) {
        tr.scrollIntoView();
      }
    }
  }

  _isLocalCursorInView(): boolean {
    if (!this.editor.view.hasFocus()) return false;

    // const isNode = /* @__PURE__ */(() => typeof process !== 'undefined' && process.release && /node|io\.js/.test(process.release.name) && Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]')()
    const isBrowser =
      /* @__PURE__ */ (() =>
        typeof window !== 'undefined' && typeof document !== 'undefined')(); //  && !isNode

    if (isBrowser && this._domSelectionInView === false) {
      // Calculate the domSelectionInView and clear by next tick after all events are finished
      setTimeout(() => {
        this._domSelectionInView = false;
      }, 0);
      this._domSelectionInView = this._isDomSelectionInView();
    }
    return this._domSelectionInView;
  }

  _isDomSelectionInView(): boolean {
    const view = this.editor.view;
    if (!('root' in view)) {
      return false;
    }
    const selection = document.getSelection();

    if (
      !selection || selection.anchorNode == null || selection.focusNode == null
    ) return false;

    const range = document.createRange();
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
    const documentElement = document.documentElement;

    return bounding.bottom >= 0 && bounding.right >= 0 &&
      bounding.left <=
        (window.innerWidth || documentElement.clientWidth || 0) &&
      bounding.top <= (window.innerHeight || documentElement.clientHeight || 0);
  }
}
