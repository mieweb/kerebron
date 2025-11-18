import {
  Fragment,
  Node,
  NodeType,
  ResolvedPos,
  Slice,
} from 'npm:prosemirror-model@latest';
import {
  AllSelection,
  Command,
  EditorState,
  TextSelection,
  Transaction,
} from 'npm:prosemirror-state@latest';

import { type CoreEditor, Extension } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandFactory,
} from '@kerebron/editor/commands';
import { createNodeFromObject } from '@kerebron/editor/utilities';
import { EditorView } from 'prosemirror-view';

function normalizeSiblings(fragment: Fragment, $context: ResolvedPos) {
  if (fragment.childCount < 2) return fragment;
  for (let d = $context.depth; d >= 0; d--) {
    let parent = $context.node(d);
    let match = parent.contentMatchAt($context.index(d));
    let lastWrap: readonly NodeType[] | undefined, result: Node[] | null = [];
    fragment.forEach((node) => {
      if (!result) return;
      let wrap = match.findWrapping(node.type), inLast;
      if (!wrap) return result = null;
      if (
        inLast = result.length && lastWrap!.length &&
          addToSibling(wrap, lastWrap!, node, result[result.length - 1], 0)
      ) {
        result[result.length - 1] = inLast;
      } else {
        if (result.length) {
          result[result.length - 1] = closeRight(
            result[result.length - 1],
            lastWrap!.length,
          );
        }
        let wrapped = withWrappers(node, wrap);
        result.push(wrapped);
        match = match.matchType(wrapped.type)!;
        lastWrap = wrap;
      }
    });
    if (result) return Fragment.from(result);
  }
  return fragment;
}

function withWrappers(node: Node, wrap: readonly NodeType[], from = 0) {
  for (let i = wrap.length - 1; i >= from; i--) {
    node = wrap[i].create(null, Fragment.from(node));
  }
  return node;
}

function addToSibling(
  wrap: readonly NodeType[],
  lastWrap: readonly NodeType[],
  node: Node,
  sibling: Node,
  depth: number,
): Node | undefined {
  if (
    depth < wrap.length && depth < lastWrap.length &&
    wrap[depth] == lastWrap[depth]
  ) {
    let inner = addToSibling(
      wrap,
      lastWrap,
      node,
      sibling.lastChild!,
      depth + 1,
    );
    if (inner) {
      return sibling.copy(
        sibling.content.replaceChild(sibling.childCount - 1, inner),
      );
    }
    let match = sibling.contentMatchAt(sibling.childCount);
    if (
      match.matchType(depth == wrap.length - 1 ? node.type : wrap[depth + 1])
    ) {
      return sibling.copy(
        sibling.content.append(
          Fragment.from(withWrappers(node, wrap, depth + 1)),
        ),
      );
    }
  }
}

function closeRight(node: Node, depth: number) {
  if (depth == 0) return node;
  let fragment = node.content.replaceChild(
    node.childCount - 1,
    closeRight(node.lastChild!, depth - 1),
  );
  let fill = node.contentMatchAt(node.childCount).fillBefore(
    Fragment.empty,
    true,
  )!;
  return node.copy(fragment.append(fill));
}

function closeRange(
  fragment: Fragment,
  side: number,
  from: number,
  to: number,
  depth: number,
  openEnd: number,
) {
  let node = side < 0 ? fragment.firstChild! : fragment.lastChild!,
    inner = node.content;
  if (fragment.childCount > 1) openEnd = 0;
  if (depth < to - 1) {
    inner = closeRange(inner, side, from, to, depth + 1, openEnd);
  }
  if (depth >= from) {
    inner = side < 0
      ? node.contentMatchAt(0)!.fillBefore(inner, openEnd <= depth)!.append(
        inner,
      )
      : inner.append(
        node.contentMatchAt(node.childCount)!.fillBefore(Fragment.empty, true)!,
      );
  }
  return fragment.replaceChild(
    side < 0 ? 0 : fragment.childCount - 1,
    node.copy(inner),
  );
}

function closeSlice(slice: Slice, openStart: number, openEnd: number) {
  if (openStart < slice.openStart) {
    slice = new Slice(
      closeRange(
        slice.content,
        -1,
        openStart,
        slice.openStart,
        0,
        slice.openEnd,
      ),
      openStart,
      slice.openEnd,
    );
  }
  if (openEnd < slice.openEnd) {
    slice = new Slice(
      closeRange(slice.content, 1, openEnd, slice.openEnd, 0, 0),
      slice.openStart,
      openEnd,
    );
  }
  return slice;
}

function sliceSingleNode(slice: Slice) {
  return slice.openStart == 0 && slice.openEnd == 0 &&
      slice.content.childCount == 1
    ? slice.content.firstChild
    : null;
}

function fixSlice(slice: Slice, $context: ResolvedPos): Slice {
  slice = Slice.maxOpen(normalizeSiblings(slice.content, $context), true);
  if (slice.openStart || slice.openEnd) {
    let openStart = 0, openEnd = 0;
    for (
      let node = slice.content.firstChild;
      openStart < slice.openStart && !node!.type.spec.isolating;
      openStart++, node = node!.firstChild
    ) {}
    for (
      let node = slice.content.lastChild;
      openEnd < slice.openEnd && !node!.type.spec.isolating;
      openEnd++, node = node!.lastChild
    ) {}
    slice = closeSlice(slice, openStart, openEnd);
  }
  return slice;
}

function sliceHasOnlyText(slice: Slice) {
  return slice.content.content.every((node) => node.isInline);
}

const selectAll: CommandFactory = () => {
  return function (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) {
    const tr = state.tr.setSelection(new AllSelection(state.doc));
    if (view) {
      view.dispatch(tr);
    }

    return true;
  };
};

function textPositionsToResolvedPos(
  textPosVec: number[],
  doc: Node,
  paraNum: number,
): ResolvedPos[] {
  const retVal = textPosVec.map((x) => -1);

  let currentTextPos = 0;
  let inParaRange = false;

  function callback(
    currentPos: number,
    level: number,
    idx: number,
    textLen: number,
  ) {
    if (!inParaRange) {
      return;
    }

    for (let i = 0; i < textPosVec.length; i++) {
      const val = textPosVec[i];
      if (val >= currentTextPos && val < currentTextPos + textLen) {
        retVal[i] = currentPos + (val - currentTextPos);
      }
    }

    currentTextPos += textLen;
  }

  function treeTraverse(
    node: Node,
    level = 0,
    idx = 0,
    currentPos = 0,
  ) {
    if (level === 1 && idx === paraNum) {
      inParaRange = true;
    }

    let textLen = 0;
    if (node.isText && node.text) {
      textLen = node.text?.length;
    } else if (node.isLeaf) {
      textLen = 1;
    }

    if (textLen > 0) {
      callback(currentPos, level, idx, textLen);
    }

    node.forEach((child, offset, childIndex) => {
      treeTraverse(child, level + 1, childIndex, currentPos + offset + 1);
    });
  }

  treeTraverse(doc);

  if (inParaRange) {
    for (let i = 0; i < textPosVec.length; i++) {
      const val = textPosVec[i];
      if (retVal[i] === -1) {
        if (val < currentTextPos) {
          retVal[i] = 1;
        } else {
          retVal[i] = doc.nodeSize - 1;
        }
      }
    }
  }

  return retVal.map((x) => doc.resolve(x - 1));
}

const selectText: CommandFactory = (
  textStart: number,
  length: number,
  paraNum = 0,
) => {
  return function (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) {
    const [$head, $anchor] = textPositionsToResolvedPos(
      [textStart + length, textStart],
      state.doc,
      paraNum,
    );

    const tr = state.tr.setSelection(new TextSelection($anchor, $head));
    if (view) {
      view.dispatch(tr);
    }

    return true;
  };
};

export class ExtensionSelection extends Extension {
  name = 'selection';

  extractSelection(): Node {
    const state = this.editor.state;
    const { from, to } = state.selection;
    const slice = state.doc.slice(from, to);

    if (sliceHasOnlyText(slice)) {
      const para = state.schema.nodes.paragraph.create(null, slice.content);
      return state.schema.topNodeType.createAndFill(null, [para])!;
    }

    return state.schema.topNodeType.createAndFill(null, slice.content)!;
  }

  replaceSelection(otherDoc: Node) {
    const preferPlain = false;
    const view = this.editor.view;
    const state = this.editor.state;

    let slice: Slice;

    if (otherDoc.type?.name === 'doc') {
      otherDoc = createNodeFromObject(otherDoc.toJSON(), this.editor.schema);
    }
    slice = new Slice(otherDoc.content, 1, 1);

    const $context = state.selection.$from;

    slice = fixSlice(slice, $context);

    let singleNode = sliceSingleNode(slice);
    let tr = singleNode
      ? state.tr.replaceSelectionWith(singleNode, preferPlain)
      : state.tr.replaceSelection(slice);
    view.dispatch(tr.scrollIntoView());
  }

  appendSelection(otherDoc: Node) {
    const view = this.editor.view;
    const { state } = view;

    let slice: Slice;

    if (otherDoc.type?.name === 'doc') {
      otherDoc = createNodeFromObject(otherDoc.toJSON(), this.editor.schema);
    }
    slice = new Slice(otherDoc.content, 1, 1);

    const $context = view.state.selection.$from;

    slice = fixSlice(slice, $context);

    const tr = state.tr.insert(view.state.selection.to, slice.content);
    view.dispatch(tr.scrollIntoView());
  }

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    this.editor = editor;
    return {
      'selectAll': () => selectAll(),
      'selectText': (...args) => selectText(...args),
    };
  }
}
