import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type Commands,
  type CommandShortcuts,
  setBlockType,
} from '@kerebron/editor/commands';

/// Build a command that splits a non-empty textblock at the top level
/// of a list item by also splitting that list item.
function splitListItem(itemType: NodeType, itemAttrs?: Attrs): Command {
  return function (state: EditorState, dispatch?: (tr: Transaction) => void) {
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
}

/// Acts like [`splitListItem`](#schema-list.splitListItem), but
/// without resetting the set of active marks at the cursor.
function splitListItemKeepMarks(
  itemType: NodeType,
  itemAttrs?: Attrs,
): Command {
  let split = splitListItem(itemType, itemAttrs);
  return (state, dispatch) => {
    return split(
      state,
      dispatch && ((tr) => {
        let marks = state.storedMarks ||
          (state.selection.$to.parentOffset && state.selection.$from.marks());
        if (marks) tr.ensureMarks(marks);
        dispatch(tr);
      }),
    );
  };
}

/// Create a command to lift the list item around the selection up into
/// a wrapping list.
function liftListItem(itemType: NodeType): Command {
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
function sinkListItem(itemType: NodeType): Command {
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

export class NodeListItem extends Node {
  override name = 'list_item';
  requires = ['doc'];

  automerge = {
    block: 'list_item',
  };

  override getNodeSpec(): NodeSpec {
    return {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      defining: true,
      toDOM() {
        return ['li', 0];
      },
    };
  }

  getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    return {
      'splitListItem': () => splitListItem(type),
      'liftListItem': () => liftListItem(type),
      'sinkListItem': () => sinkListItem(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      // 'Enter': 'splitListItem',
      'Mod-[': 'liftListItem',
      'Mod-]': 'sinkListItem',
    };
  }
}
