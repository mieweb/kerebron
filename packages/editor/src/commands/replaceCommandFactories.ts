import { Fragment, Node, Slice } from 'prosemirror-model';

import type { Command, CommandFactory } from '@kerebron/editor/commands';
import type { TextRange } from '@kerebron/editor';
import { EditorState } from 'prosemirror-state';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Replace the given range with plain text; an empty string clears the range.
     *
     * @param range The document range to replace.
     * @param text The text to insert.
     */
    replaceRangeText: (range: TextRange, text: string) => ReturnType;
    /**
     * Replace the given range with a slice.
     *
     * @param range The document range to replace.
     * @param insert The slice to insert.
     */
    replaceRangeSlice: (range: TextRange, insert: Slice) => ReturnType;
    /**
     * Insert a block node before the top-most block containing `pos`.
     *
     * @param pos A position inside the reference block.
     * @param insert The block node to insert.
     */
    insertBlockBefore: (pos: number, insert: Node) => ReturnType;
    /**
     * Insert a block node after the top-most block containing `pos`.
     *
     * @param pos A position inside the reference block.
     * @param insert The block node to insert.
     */
    insertBlockAfter: (pos: number, insert: Node) => ReturnType;
    /**
     * Insert a block node next to the top-most block containing `pos`:
     * before it when `pos` is at the block start, after it otherwise.
     *
     * @param pos A position inside the reference block.
     * @param insert The block node to insert.
     */
    insertBlockSmart: (pos: number, insert: Node) => ReturnType;
  }
}

const replaceRangeText = (range: TextRange, text: string): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const from = tr.mapping.map(range.from);
    const to = tr.mapping.map(range.to);

    if (text.length > 0) {
      const frag = Fragment.from(state.schema.text(text));
      const insert = new Slice(frag, 0, 0);

      tr.replace(from, to, insert);
    } else {
      const frag = Fragment.from(state.schema.topNodeType.createAndFill());

      const insert = new Slice(frag, 0, 0);
      tr.replace(from, to, insert);
    }

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
};

const replaceRangeSlice = (range: TextRange, insert: Slice): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const from = tr.mapping.map(range.from);
    const to = tr.mapping.map(range.to);

    tr.replace(from, to, insert);

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
};

function getTopMostBlockStartForOffset(state: EditorState, offset: number) {
  const { doc } = state;
  const $pos = doc.resolve(offset);

  const blockPos = $pos.before($pos.depth);

  if ($pos.depth === 1) return blockPos;
  return $pos.start(1);
}

function getTopMostBlockEndForOffset(state: EditorState, offset: number) {
  const { doc } = state;

  const $pos = doc.resolve(offset);
  return $pos.end(1);
}

function getAdjacentTopBlock(state: EditorState, offset: number) {
  const { doc } = state;

  if (offset < 0 || offset > doc.content.size) {
    throw new RangeError('Offset is outside the document');
  }

  const $pos = doc.resolve(offset);
  const atBlockStart = $pos.pos === $pos.start($pos.depth);

  if (atBlockStart) {
    return getTopMostBlockStartForOffset(state, offset);
  } else {
    return getTopMostBlockEndForOffset(state, offset);
  }
}

const insertBlockBefore = (pos: number, insert: Node): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const blockPos = getTopMostBlockStartForOffset(state, tr.mapping.map(pos));
    tr.insert(blockPos, insert);

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
};

const insertBlockAfter = (pos: number, insert: Node): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const blockPos = getTopMostBlockEndForOffset(state, tr.mapping.map(pos));
    tr.insert(blockPos, insert);

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
};

const insertBlockSmart = (pos: number, insert: Node): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const blockPos = getAdjacentTopBlock(state, tr.mapping.map(pos));
    tr.insert(blockPos, insert);

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
};

export const replaceCommandFactories: Record<string, CommandFactory> = {
  replaceRangeText,
  replaceRangeSlice,
  insertBlockBefore,
  insertBlockAfter,
  insertBlockSmart,
};
