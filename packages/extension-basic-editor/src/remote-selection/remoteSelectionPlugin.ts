import { Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';
import { type DecorationAttrs } from 'prosemirror-view';

import type { CoreEditor } from '@kerebron/editor';

import type { ExtensionRemoteSelection } from './ExtensionRemoteSelection.ts';

export const remoteSelectionPluginKey = new PluginKey('remote-selection');

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
  extension: ExtensionRemoteSelection,
  createCursor: (
    user: { name: string; color: string },
    clientId: number,
  ) => Element,
  createSelection: (
    user: { name: string; color: string },
    clientId: number,
  ) => DecorationAttrs,
): any => {
  const decorations: Decoration[] = [];

  const remoteStates = extension.getRemoteStates();
  if (remoteStates.length === 0) {
    return DecorationSet.create(state.doc, []);
  }

  for (const remoteState of remoteStates) {
    if (remoteState.cursor != null) {
      const user = remoteState.user || {};
      if (user.color == null) {
        user.color = '#ffa500';
      } else if (!rxValidColor.test(user.color)) {
        // We only support 6-digit RGB colors in y-prosemirror
        console.warn('A user uses an unsupported color format', user);
      }
      if (user.name == null) {
        user.name = `User: ${remoteState.clientId}`;
      }

      const cursor = remoteState.cursor;
      let anchor = cursor.anchor || null;
      let head = cursor.head || null;

      if (anchor !== null && head !== null) {
        const maxsize = Math.max(state.doc.content.size - 1, 0);
        anchor = Math.min(anchor, maxsize);
        head = Math.min(head, maxsize);
        decorations.push(
          Decoration.widget(
            head,
            () => createCursor(user, remoteState.clientId),
            {
              key: remoteState.clientId + '',
              side: 10,
            },
          ),
        );
        const from = Math.min(anchor, head);
        const to = Math.max(anchor, head);
        decorations.push(
          Decoration.inline(
            from,
            to,
            createSelection(user, remoteState.clientId),
            {
              inclusiveEnd: true,
              inclusiveStart: false,
            },
          ),
        );
      }
    }
  }
  return DecorationSet.create(state.doc, decorations);
};

export const remoteSelectionPlugin = (
  extension: ExtensionRemoteSelection,
  editor: CoreEditor,
  {
    cursorBuilder = defaultCursorBuilder,
    selectionBuilder = defaultSelectionBuilder,
  }: {
    cursorBuilder?: (user: any, clientId: number) => HTMLElement;
    selectionBuilder?: (user: any, clientId: number) => DecorationAttrs;
  } = {},
) => {
  return new Plugin({
    key: remoteSelectionPluginKey,
    state: {
      init(_, state) {
        return createDecorations(
          state,
          extension,
          cursorBuilder,
          selectionBuilder,
        );
      },
      apply(tr, prevState, _oldState, newState) {
        const remoteCursorState = tr.getMeta(remoteSelectionPluginKey);
        // TODO validate: isChangeOrigin
        // const state = remoteSelectionPluginKey.getState(newState);

        if (
          (remoteCursorState?.isChangeOrigin) ||
          (remoteCursorState?.remotePositionUpdated)
        ) {
          return createDecorations(
            newState,
            extension,
            cursorBuilder,
            selectionBuilder,
          );
        }
        return prevState.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => {
        return remoteSelectionPluginKey.getState(state);
      },
    },
  });
};
