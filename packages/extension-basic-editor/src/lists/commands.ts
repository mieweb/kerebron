import {
  type Attrs,
  Fragment,
  Mark,
  Node as PMNode,
  NodeRange,
  type NodeType,
  ResolvedPos,
  Slice,
} from 'prosemirror-model';
import {
  EditorState,
  NodeSelection,
  Selection,
  Transaction,
} from 'prosemirror-state';
import {
  canJoin,
  canSplit,
  liftTarget,
  ReplaceAroundStep,
} from 'prosemirror-transform';

import type { Command, CommandFactory } from '@kerebron/editor/commands';

/// Build a command that splits a non-empty textblock at the top level
/// of a list item by also splitting that list item.
export function splitListItem(itemType: NodeType, itemAttrs?: Attrs): Command {
  const cmd: Command = function (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
  ) {
    const { $from, $to, node } = state.selection as NodeSelection;
    if ((node && node.isBlock) || $from.depth < 2 || !$from.sameParent($to)) {
      return false;
    }
    const grandParent = $from.node(-1);
    if (grandParent.type != itemType) return false;
    if (
      $from.parent.content.size == 0 &&
      $from.node(-1).childCount == $from.indexAfter(-1)
    ) {
      // In an empty block. If this is a nested list, the wrapping
      // list item should be split. Otherwise, bail out and let next
      // command handle lifting.
      if (
        $from.depth == 3 || $from.node(-3).type != itemType ||
        $from.index(-2) != $from.node(-2).childCount - 1
      ) return false;
      if (dispatch) {
        let wrap = Fragment.empty;
        const depthBefore = $from.index(-1) ? 1 : $from.index(-2) ? 2 : 3;
        // Build a fragment containing empty versions of the structure
        // from the outer list item to the parent node of the cursor
        for (let d = $from.depth - depthBefore; d >= $from.depth - 3; d--) {
          wrap = Fragment.from($from.node(d).copy(wrap));
        }
        let depthAfter = $from.indexAfter(-1) < $from.node(-2).childCount
          ? 1
          : $from.indexAfter(-2) < $from.node(-3).childCount
          ? 2
          : 3;
        // Add a second list item with an empty default start node
        wrap = wrap.append(Fragment.from(itemType.createAndFill()));
        let start = $from.before($from.depth - (depthBefore - 1));
        let tr = state.tr.replace(
          start,
          $from.after(-depthAfter),
          new Slice(wrap, 4 - depthBefore, 0),
        );
        let sel = -1;
        tr.doc.nodesBetween(start, tr.doc.content.size, (node, pos) => {
          if (sel > -1) return false;
          if (node.isTextblock && node.content.size == 0) sel = pos + 1;
        });
        if (sel > -1) tr.setSelection(Selection.near(tr.doc.resolve(sel)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    let nextType = $to.pos == $from.end()
      ? grandParent.contentMatchAt(0).defaultType
      : null;
    let tr = state.tr.delete($from.pos, $to.pos);
    let types = nextType
      ? [itemAttrs ? { type: itemType, attrs: itemAttrs } : null, {
        type: nextType,
      }]
      : undefined;
    if (!canSplit(tr.doc, $from.pos, 2, types)) return false;
    if (dispatch) dispatch(tr.split($from.pos, 2, types).scrollIntoView());
    return true;
  };

  cmd.displayName = `splitListItem(${itemType.name})`;

  return cmd;
}

/// Acts like [`splitListItem`](#schema-list.splitListItem), but
/// without resetting the set of active marks at the cursor.
function splitListItemKeepMarks(
  itemType: NodeType,
  itemAttrs?: Attrs,
): Command {
  let split = splitListItem(itemType, itemAttrs);
  return function (state, dispatch) {
    return split.apply(this, [
      state,
      dispatch && ((tr) => {
        let marks = state.storedMarks ||
          (state.selection.$to.parentOffset && state.selection.$from.marks());
        if (marks) tr.ensureMarks(marks);
        dispatch(tr);
      }),
    ]);
  };
}

/// Create a command to lift the list item around the selection up into
/// a wrapping list.
export function liftListItem(itemType: NodeType): Command {
  return function (state: EditorState, dispatch?: (tr: Transaction) => void) {
    let { $from, $to } = state.selection;
    let range = $from.blockRange(
      $to,
      (node) => node.childCount > 0 && node.firstChild!.type == itemType,
    );
    if (!range) return false;
    if (!dispatch) return true;
    if ($from.node(range.depth - 1).type == itemType) { // Inside a parent list
      return liftToOuterList(state, dispatch, itemType, range);
    } // Outer list node
    else {
      return liftOutOfList(state, dispatch, range);
    }
  };
}

function liftToOuterList(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  itemType: NodeType,
  range: NodeRange,
) {
  let tr = state.tr, end = range.end, endOfList = range.$to.end(range.depth);
  if (end < endOfList) {
    // There are siblings after the lifted items, which must become
    // children of the last item
    tr.step(
      new ReplaceAroundStep(
        end - 1,
        endOfList,
        end,
        endOfList,
        new Slice(
          Fragment.from(itemType.create(null, range.parent.copy())),
          1,
          0,
        ),
        1,
        true,
      ),
    );
    range = new NodeRange(
      tr.doc.resolve(range.$from.pos),
      tr.doc.resolve(endOfList),
      range.depth,
    );
  }
  const target = liftTarget(range);
  if (target == null) return false;
  tr.lift(range, target);
  let $after = tr.doc.resolve(tr.mapping.map(end, -1) - 1);
  if (
    canJoin(tr.doc, $after.pos) &&
    $after.nodeBefore!.type == $after.nodeAfter!.type
  ) tr.join($after.pos);
  dispatch(tr.scrollIntoView());
  return true;
}

function liftOutOfList(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  range: NodeRange,
) {
  let tr = state.tr, list = range.parent;
  // Merge the list items into a single big item
  for (
    let pos = range.end, i = range.endIndex - 1, e = range.startIndex;
    i > e;
    i--
  ) {
    pos -= list.child(i).nodeSize;
    tr.delete(pos - 1, pos + 1);
  }
  let $start = tr.doc.resolve(range.start), item = $start.nodeAfter!;
  if (tr.mapping.map(range.end) != range.start + $start.nodeAfter!.nodeSize) {
    return false;
  }
  let atStart = range.startIndex == 0,
    atEnd = range.endIndex == list.childCount;
  let parent = $start.node(-1), indexBefore = $start.index(-1);
  if (
    !parent.canReplace(
      indexBefore + (atStart ? 0 : 1),
      indexBefore + 1,
      item.content.append(atEnd ? Fragment.empty : Fragment.from(list)),
    )
  ) {
    return false;
  }
  let start = $start.pos, end = start + item.nodeSize;
  // Strip off the surrounding list. At the sides where we're not at
  // the end of the list, the existing list is closed. At sides where
  // this is the end, it is overwritten to its end.
  tr.step(
    new ReplaceAroundStep(
      start - (atStart ? 1 : 0),
      end + (atEnd ? 1 : 0),
      start + 1,
      end - 1,
      new Slice(
        (atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)))
          .append(
            atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)),
          ),
        atStart ? 0 : 1,
        atEnd ? 0 : 1,
      ),
      atStart ? 0 : 1,
    ),
  );
  dispatch(tr.scrollIntoView());
  return true;
}

/// Create a command to sink the list item around the selection down
/// into an inner list.
export function sinkListItem(itemType: NodeType): Command {
  return function (state, dispatch) {
    const { $from, $to } = state.selection;
    const range = $from.blockRange(
      $to,
      (node) => node.childCount > 0 && node.firstChild!.type == itemType,
    );
    if (!range) return false;
    const startIndex = range.startIndex;
    if (startIndex == 0) return false;
    const parent = range.parent, nodeBefore = parent.child(startIndex - 1);
    if (nodeBefore.type != itemType) return false;

    if (dispatch) {
      const nestedBefore = nodeBefore.lastChild &&
        nodeBefore.lastChild.type == parent.type;
      const inner = Fragment.from(nestedBefore ? itemType.create() : null);
      const slice = new Slice(
        Fragment.from(
          itemType.create(null, Fragment.from(parent.type.create(null, inner))),
        ),
        nestedBefore ? 3 : 1,
        0,
      );
      const before = range.start, after = range.end;
      dispatch(
        state.tr.step(
          new ReplaceAroundStep(
            before - (nestedBefore ? 3 : 1),
            after,
            before,
            after,
            slice,
            1,
            true,
          ),
        )
          .scrollIntoView(),
      );
    }
    return true;
  };
}

const isList = (name: string) => {
  return name.endsWith('_list');
};

export const clearNodes: CommandFactory = () => (state, dispatch) => {
  const tr = state.tr;
  const { selection } = tr;
  const { ranges } = selection;

  if (!dispatch) {
    return true;
  }

  ranges.forEach(({ $from, $to }) => {
    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.type.isText) {
        return;
      }

      const { doc, mapping } = tr;
      const $mappedFrom = doc.resolve(mapping.map(pos));
      const $mappedTo = doc.resolve(mapping.map(pos + node.nodeSize));
      const nodeRange = $mappedFrom.blockRange($mappedTo);

      if (!nodeRange) {
        return;
      }

      const targetLiftDepth = liftTarget(nodeRange);

      if (node.type.isTextblock) {
        const { defaultType } = $mappedFrom.parent.contentMatchAt(
          $mappedFrom.index(),
        );

        tr.setNodeMarkup(nodeRange.start, defaultType);
      }

      if (targetLiftDepth || targetLiftDepth === 0) {
        tr.lift(nodeRange, targetLiftDepth);
      }
    });
  });

  return true;
};

export function findParentNodeClosestToPos(
  $pos: ResolvedPos,
  predicate: Predicate,
):
  | {
    pos: number;
    start: number;
    depth: number;
    node: PMNode;
  }
  | undefined {
  for (let i = $pos.depth; i > 0; i -= 1) {
    const node = $pos.node(i);

    if (predicate(node)) {
      return {
        pos: i > 0 ? $pos.before(i) : 0,
        start: $pos.start(i),
        depth: i,
        node,
      };
    }
  }
}

export type Predicate = (node: PMNode) => boolean;

export function findParentNode(predicate: Predicate) {
  return (selection: Selection) =>
    findParentNodeClosestToPos(selection.$from, predicate);
}

const joinListBackwards = (tr: Transaction, listType: NodeType): boolean => {
  const list = findParentNode((node) => node.type === listType)(tr.selection);

  if (!list) {
    return true;
  }

  const before = tr.doc.resolve(Math.max(0, list.pos - 1)).before(list.depth);

  if (before === undefined) {
    return true;
  }

  const nodeBefore = tr.doc.nodeAt(before);
  const canJoinBackwards = list.node.type === nodeBefore?.type &&
    canJoin(tr.doc, list.pos);

  if (!canJoinBackwards) {
    return true;
  }

  tr.join(list.pos);

  return true;
};

const joinListForwards = (tr: Transaction, listType: NodeType): boolean => {
  const list = findParentNode((node) => node.type === listType)(tr.selection);

  if (!list) {
    return true;
  }

  const after = tr.doc.resolve(list.start).after(list.depth);

  if (after === undefined) {
    return true;
  }

  const nodeAfter = tr.doc.nodeAt(after);
  const canJoinForwards = list.node.type === nodeAfter?.type &&
    canJoin(tr.doc, after);

  if (!canJoinForwards) {
    return true;
  }

  tr.join(after);

  return true;
};

export const toggleList: CommandFactory = (
  listTypeOrName,
  itemTypeOrName,
  keepMarks,
  attributes = {},
): Command =>
  function (
    state,
    dispatch,
    view,
  ): boolean {
    if (!this) {
      throw new Error('Call this with Function.apply');
    }

    const editor = this.editor;

    const splittableMarks: string[] = Object.keys(state.schema.marks).filter(
      (name) => name !== 'link',
    );
    const listType = state.schema.nodes[listTypeOrName];
    const itemType = state.schema.nodes[itemTypeOrName];
    const { selection, storedMarks } = state;
    const { $from, $to } = selection;
    const range = $from.blockRange($to);

    const marks: readonly Mark[] = storedMarks ||
      (selection.$to.parentOffset ? selection.$from.marks() : []);

    if (!range) {
      return false;
    }

    const parentList = findParentNode((node) => isList(node.type.name))(
      selection,
    );

    const tr = state.tr;

    if (range.depth >= 1 && parentList && range.depth - parentList.depth <= 1) {
      // remove list
      if (parentList.node.type === listType) {
        return liftListItem(itemType).apply(this, [state, dispatch, view]);
      }

      // change list type
      if (
        isList(parentList.node.type.name) &&
        listType.validContent(parentList.node.content) &&
        dispatch
      ) {
        return editor.chain(tr)
          .command(() => {
            tr.setNodeMarkup(parentList.pos, listType);

            return true;
          })
          .command(() => joinListBackwards(tr, listType))
          .command(() => joinListForwards(tr, listType))
          .command(() => dispatch(tr))
          .run();
      }
    }
    if (!keepMarks || !marks || !dispatch) {
      return editor.chain(tr)
        // try to convert node to default node if needed
        .command(() => {
          const canWrapInList = editor.can().wrapInList(listType, attributes)
            .run();

          if (canWrapInList) {
            return true;
          }

          // return clearNodes().apply(this, [state, dispatch, view]);
          return editor.chain(tr).lift().run();
        })
        .wrapInList(listType, attributes)
        .command(() => joinListBackwards(tr, listType))
        .command(() => joinListForwards(tr, listType))
        .command(() => {
          if (dispatch) dispatch(tr);
          return true;
        })
        .run();
    }

    return (
      editor.chain(tr)
        // try to convert node to default node if needed
        .command(() => {
          const canWrapInList = editor.can().wrapInList(listType, attributes)
            .run();

          const filteredMarks = marks.filter((mark) =>
            splittableMarks.includes(mark.type.name)
          );

          tr.ensureMarks(filteredMarks);

          if (canWrapInList) {
            return true;
          }

          if (parentList) {
            tr.setSelection(NodeSelection.create(state.doc, parentList.pos));
          }

          return clearNodes().apply(this, [state, dispatch, view]);
        })
        .wrapInList(listType, attributes)
        .command(() => joinListBackwards(tr, listType))
        .command(() => joinListForwards(tr, listType))
        .command(() => {
          if (dispatch) dispatch(tr);
          return true;
        })
        .run()
    );
  };
