import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view'; // eslint-disable-line

import { DocHandleChangePayload } from './types.ts';

export const cursorPluginKey = new PluginKey('automerge-cursor');

const getSelection = (state) => state.selection;

export const createDecorations = (
  state,
  // awareness,
  // awarenessFilter,
  createCursor,
  createSelection,
) => {
  const decorations = [];

  const user = { color: '#FF00' };

  decorations.push(
    Decoration.inline(1, 2, createSelection(user), {
      inclusiveEnd: true,
      inclusiveStart: false,
    }),
  );

  return DecorationSet.create(state.doc, decorations);
};

export const defaultSelectionBuilder = (user) => {
  return {
    style: `background-color: ${user.color}70`,
    // assets: `border-left: 1px solid ${user.color}70`,
    class: 'kb-automerge__selection',
  };
};

export const defaultCursorBuilder = (user) => {
  const cursor = document.createElement('span');
  cursor.classList.add('kb-automerge__cursor');
  cursor.setAttribute('style', `border-color: ${user.color}`);
  const userDiv = document.createElement('div');
  userDiv.setAttribute('style', `background-color: ${user.color}`);
  userDiv.insertBefore(document.createTextNode(user.name), null);
  const nonbreakingSpace1 = document.createTextNode('\u2060');
  const nonbreakingSpace2 = document.createTextNode('\u2060');
  cursor.insertBefore(nonbreakingSpace1, null);
  cursor.insertBefore(userDiv, null);
  cursor.insertBefore(nonbreakingSpace2, null);
  return cursor;
};

const cursorBuilder = defaultCursorBuilder;
const selectionBuilder = defaultSelectionBuilder;

export class CursorPlugin extends Plugin {
  ignoreTr = false;
  onAutoMergeChange!: (args: DocHandleChangePayload<unknown>) => void;

  constructor() {
    super({
      key: cursorPluginKey,
      state: {
        init(_, state) {
          return createDecorations(
            state,
            // awareness,
            // awarenessStateFilter,
            cursorBuilder,
            selectionBuilder,
          );
        },
        apply(tr, prevState, _oldState, newState) {
          // const ystate = ySyncPluginKey.getState(newState)
          // const yCursorState = tr.getMeta(yCursorPluginKey)
          // if (
          //     (ystate && ystate.isChangeOrigin) ||
          //     (yCursorState && yCursorState.awarenessUpdated)
          // ) {
          //     return createDecorations(
          //         newState,
          //         awareness,
          //         awarenessStateFilter,
          //         cursorBuilder,
          //         selectionBuilder
          //     )
          // }
          return prevState.map(tr.mapping, tr.doc);
        },
      },
      props: {
        decorations: (state) => {
          return cursorPluginKey.getState(state);
        },
      },
      view: (view) => {
        // const awarenessListener = () => {
        //     if (view.docView) {
        //         setMeta(view, yCursorPluginKey, { awarenessUpdated: true })
        //     }
        // }
        const updateCursorInfo = () => {
          // @note We make implicit checks when checking for the cursor property
          // const current = awareness.getLocalState() || {}
          if (view.hasFocus()) {
            const selection = getSelection(view.state);
          }
        };
        // awareness.on('change', awarenessListener)
        view.dom.addEventListener('focusin', updateCursorInfo);
        view.dom.addEventListener('focusout', updateCursorInfo);
        return {
          update: updateCursorInfo,
          destroy: () => {
            view.dom.removeEventListener('focusin', updateCursorInfo);
            view.dom.removeEventListener('focusout', updateCursorInfo);
            // awareness.off('change', awarenessListener)
            // awareness.setLocalStateField(cursorStateField, null)
          },
        };
      },
    });
  }
}
