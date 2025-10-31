import { Fragment, Slice } from 'prosemirror-model';

import type { Command, CommandFactory } from '@kerebron/editor/commands';
import type { TextRange } from '@kerebron/editor';

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

export const replaceCommandFactories: Record<string, CommandFactory> = {
  replaceRangeText,
};
