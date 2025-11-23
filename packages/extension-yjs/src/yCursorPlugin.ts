import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { Decoration, DecorationSet } from 'prosemirror-view'; // eslint-disable-line
import { EditorState, Plugin } from 'prosemirror-state'; // eslint-disable-line
import { type DecorationAttrs } from 'prosemirror-view';

import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  setMeta,
} from './lib.ts';

import { yCursorPluginKey, ySyncPluginKey } from './keys.ts';

import * as math from 'lib0/math';

/**
 * Default awareness state filter
 */
export const defaultAwarenessStateFilter = (
  currentClientId: number,
  userClientId: number,
  _user: any,
): boolean => currentClientId !== userClientId;

/**
 * Default generator for a cursor element
 */
export const defaultCursorBuilder = (user: any): HTMLElement => {
  const cursor = document.createElement('span');
  cursor.classList.add('kb-yjs__cursor');
  cursor.setAttribute('style', `border-color: ${user.color};`);
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

/**
 * Default generator for the selection attributes
 */
export const defaultSelectionBuilder = (user: any): DecorationAttrs => {
  return {
    style: `background-color: ${user.color}70`,
    class: 'kb-yjs__selection',
  };
};

const rxValidColor = /^#[0-9a-fA-F]{6}$/;

export const createDecorations = (
  state: any,
  awareness: awarenessProtocol.Awareness,
  awarenessFilter: (arg0: number, arg1: number, arg2: any) => boolean,
  createCursor: (
    user: { name: string; color: string },
    clientId: number,
  ) => Element,
  createSelection: (
    user: { name: string; color: string },
    clientId: number,
  ) => DecorationAttrs,
): any => {
  const ystate = ySyncPluginKey.getState(state);
  const y = ystate.doc;
  const decorations = [];
  if (
    ystate.snapshot != null || ystate.prevSnapshot != null ||
    ystate.binding.mapping.size === 0
  ) {
    // do not render cursors while snapshot is active
    return DecorationSet.create(state.doc, []);
  }
  awareness.getStates().forEach((aw, clientId) => {
    if (!awarenessFilter(y.clientID, clientId, aw)) {
      return;
    }

    if (aw.cursor != null) {
      const user = aw.user || {};
      if (user.color == null) {
        user.color = '#ffa500';
      } else if (!rxValidColor.test(user.color)) {
        // We only support 6-digit RGB colors in y-prosemirror
        console.warn('A user uses an unsupported color format', user);
      }
      if (user.name == null) {
        user.name = `User: ${clientId}`;
      }
      let anchor = relativePositionToAbsolutePosition(
        y,
        ystate.type,
        Y.createRelativePositionFromJSON(aw.cursor.anchor),
        ystate.binding.mapping,
      );
      let head = relativePositionToAbsolutePosition(
        y,
        ystate.type,
        Y.createRelativePositionFromJSON(aw.cursor.head),
        ystate.binding.mapping,
      );
      if (anchor !== null && head !== null) {
        const maxsize = math.max(state.doc.content.size - 1, 0);
        anchor = math.min(anchor, maxsize);
        head = math.min(head, maxsize);
        decorations.push(
          Decoration.widget(head, () => createCursor(user, clientId), {
            key: clientId + '',
            side: 10,
          }),
        );
        const from = math.min(anchor, head);
        const to = math.max(anchor, head);
        decorations.push(
          Decoration.inline(from, to, createSelection(user, clientId), {
            inclusiveEnd: true,
            inclusiveStart: false,
          }),
        );
      }
    }
  });
  return DecorationSet.create(state.doc, decorations);
};

export const yCursorPlugin = (
  awareness: awarenessProtocol.Awareness,
  {
    awarenessStateFilter = defaultAwarenessStateFilter,
    cursorBuilder = defaultCursorBuilder,
    selectionBuilder = defaultSelectionBuilder,
    getSelection = (state: EditorState) => state.selection,
  }: {
    awarenessStateFilter?: (arg0: any, arg1: any, arg2: any) => boolean;
    cursorBuilder?: (user: any, clientId: number) => HTMLElement;
    selectionBuilder?: (user: any, clientId: number) => DecorationAttrs;
    getSelection?: (arg0: any) => any;
  } = {},
  cursorStateField: string = 'cursor',
) => {
  return new Plugin({
    key: yCursorPluginKey,
    state: {
      init(_, state) {
        return createDecorations(
          state,
          awareness,
          awarenessStateFilter,
          cursorBuilder,
          selectionBuilder,
        );
      },
      apply(tr, prevState, _oldState, newState) {
        const ystate = ySyncPluginKey.getState(newState);
        const yCursorState = tr.getMeta(yCursorPluginKey);
        if (
          (ystate && ystate.isChangeOrigin) ||
          (yCursorState && yCursorState.awarenessUpdated)
        ) {
          return createDecorations(
            newState,
            awareness,
            awarenessStateFilter,
            cursorBuilder,
            selectionBuilder,
          );
        }
        return prevState.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => {
        return yCursorPluginKey.getState(state);
      },
    },
    view: (view) => {
      const awarenessListener = () => {
        if ('docView' in view) {
          setMeta(view, yCursorPluginKey, { awarenessUpdated: true });
        }
      };
      const updateCursorInfo = () => {
        const ystate = ySyncPluginKey.getState(view.state);
        // @note We make implicit checks when checking for the cursor property
        const current = awareness.getLocalState() || {};

        const selection = getSelection(view.state);

        if (view.hasFocus()) {
          const selection = getSelection(view.state);
          /**
           * @type {Y.RelativePosition}
           */
          const anchor = absolutePositionToRelativePosition(
            selection.anchor,
            ystate.type,
            ystate.binding.mapping,
          );
          /**
           * @type {Y.RelativePosition}
           */
          const head = absolutePositionToRelativePosition(
            selection.head,
            ystate.type,
            ystate.binding.mapping,
          );
          if (
            current.cursor == null ||
            !Y.compareRelativePositions(
              Y.createRelativePositionFromJSON(current.cursor.anchor),
              anchor,
            ) ||
            !Y.compareRelativePositions(
              Y.createRelativePositionFromJSON(current.cursor.head),
              head,
            )
          ) {
            awareness.setLocalStateField(cursorStateField, {
              anchor,
              head,
            });
            awareness.setLocalStateField('cm-cursor', null);
          }
        } else if (
          current.cursor != null &&
          relativePositionToAbsolutePosition(
              ystate.doc,
              ystate.type,
              Y.createRelativePositionFromJSON(current.cursor.anchor),
              ystate.binding.mapping,
            ) !== null
        ) {
          // delete cursor information if current cursor information is owned by this editor binding
          awareness.setLocalStateField(cursorStateField, null);
        }
      };
      awareness.on('change', awarenessListener);
      view.dom.addEventListener('focusin', updateCursorInfo);
      view.dom.addEventListener('focusout', updateCursorInfo);
      return {
        update: updateCursorInfo,
        destroy: () => {
          view.dom.removeEventListener('focusin', updateCursorInfo);
          view.dom.removeEventListener('focusout', updateCursorInfo);
          awareness.off('change', awarenessListener);
          awareness.setLocalStateField(cursorStateField, null);
        },
      };
    },
    updateCursorInfo(state: EditorState) {
      const ystate = ySyncPluginKey.getState(state);
      // @note We make implicit checks when checking for the cursor property
      const current = awareness.getLocalState() || {};

      const selection = getSelection(state);
      const anchor: Y.RelativePosition = absolutePositionToRelativePosition(
        selection.anchor,
        ystate.type,
        ystate.binding.mapping,
      );
      const head: Y.RelativePosition = absolutePositionToRelativePosition(
        selection.head,
        ystate.type,
        ystate.binding.mapping,
      );
      if (
        current.cursor == null ||
        !Y.compareRelativePositions(
          Y.createRelativePositionFromJSON(current.cursor.anchor),
          anchor,
        ) ||
        !Y.compareRelativePositions(
          Y.createRelativePositionFromJSON(current.cursor.head),
          head,
        )
      ) {
        awareness.setLocalStateField(cursorStateField, {
          anchor,
          head,
        });
        awareness.setLocalStateField('cm-cursor', null);
      }

      // delete cursor information if current cursor information is owned by this editor binding
      // awareness.setLocalStateField(cursorStateField, null);
    },
  });
};
