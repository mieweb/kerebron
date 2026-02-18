import { Node } from 'prosemirror-model';

import { EditorState, Transaction } from 'prosemirror-state';
import { CommandFactory } from '@kerebron/editor/commands';
import {
  NESTING_CLOSING,
  NESTING_OPENING,
  NESTING_SELF_CLOSING,
} from '@kerebron/editor';

function generateId(): string {
  return String(Math.random());
}

type NodeAndPos = { node: Node; pos: number };

export function buildPairingTransaction(
  state: EditorState,
  type: string,
  tr: Transaction,
) {
  const { doc } = state;

  const stackMap: Map<string, Array<NodeAndPos>> = new Map();
  const nodes: Array<NodeAndPos> = [];

  doc.descendants((node, pos) => {
    if (node.type.name === type) {
      nodes.push({ node, pos });
    }
  });

  let modified = false;

  for (const { node, pos } of nodes) {
    const raw = node.attrs.content?.trim();
    if (!raw) continue;

    const match = raw.match(/^[^0-9a-z\/]*(\/?)[\s]*([\w]+)/i);
    const isClosing = match[1] === '/';
    const name = match[2];

    if (!isClosing) {
      if (!stackMap.has(name)) {
        stackMap.set(name, []);
      }

      stackMap.get(name)!.push({ node, pos });
    } else {
      const stack = stackMap.get(name);

      if (stack && stack.length > 0) {
        const opening = stack.pop()!;
        const id = generateId();

        tr.setNodeMarkup(opening.pos, undefined, {
          ...opening.node.attrs,
          id,
          nesting: NESTING_OPENING,
          error: undefined,
        });

        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id,
          nesting: NESTING_CLOSING,
          error: undefined,
        });
      } else {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          error: 'Closing shortcode without matching opening',
          nesting: NESTING_CLOSING,
        });
      }

      modified = true;
    }
  }

  // Any leftover openings are self-closing (no matching close)
  for (const [, stack] of stackMap.entries()) {
    for (const { node, pos } of stack) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        nesting: NESTING_SELF_CLOSING,
        id: undefined,
      });
      modified = true;
    }
  }

  return modified ? tr : null;
}

export const pairNodes: CommandFactory = (type: string) => {
  return (state: EditorState, dispatch) => {
    const tr = buildPairingTransaction(state, type, state.tr);
    if (!tr) {
      return false;
    }

    if (dispatch) {
      dispatch(tr);
    }
    return true;
  };
};
