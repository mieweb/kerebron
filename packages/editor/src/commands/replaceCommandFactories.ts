import { Fragment, Node, Slice } from 'prosemirror-model';

import type { Command, CommandFactory } from '@kerebron/editor/commands';
import type { TextRange } from '@kerebron/editor';
import { EditorState } from 'prosemirror-state';

const replaceRangeText = (range: TextRange, text: string): Command => {
  return (state, dispatch) => {
    const tr = state.tr;

    const from = tr.mapping.map(range.from);
    const to = tr.mapping.map(range.to);

    const frag = Fragment.from(state.schema.text(text));
    const insert = new Slice(frag, 0, 0);

    tr.replace(from, to, insert);

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
