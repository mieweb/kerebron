import { Decoration, DecorationSet } from 'prosemirror-view';
import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { type DecorationAttrs } from 'prosemirror-view';

import {
  type ColorMapper,
  defaultColorMapper,
  generateBlankUser,
  type User,
} from '@kerebron/editor/user';

import type { SelectionState } from './ExtensionRemoteSelection.ts';

export const remoteSelectionPluginKey = new PluginKey<RemoteSelectionState>(
  'remote-selection',
);

interface RemoteSelectionState {
  remoteStates: SelectionState[];
  me: User;
  colorMapper: ColorMapper;
}

/**
 * Default generator for a cursor element
 */
export const defaultCursorBuilder = (
  user: User,
  me: User,
  colorMapper: ColorMapper,
): HTMLElement => {
  const colorPair = colorMapper(user, me);
  const color = colorPair.light;

  const cursor = document.createElement('span');
  cursor.classList.add('kb-yjs__cursor');
  cursor.setAttribute('style', `border-color: ${color};`);
  const userDiv = document.createElement('div');
  userDiv.setAttribute('style', `background-color: ${color}`);
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
export const defaultSelectionBuilder = (
  user: User,
  me: User,
  colorMapper: ColorMapper,
): DecorationAttrs => {
  const colorPair = colorMapper(user, me);
  const color = colorPair.light;

  return {
    style: `background-color: ${color}70`,
    class: 'kb-yjs__selection',
  };
};

export const createDecorations = (
  state: EditorState,
  pluginState: RemoteSelectionState,
  createCursor: (
    user: User,
    me: User,
    colorMapper: ColorMapper,
  ) => Element,
  createSelection: (
    user: User,
    me: User,
    colorMapper: ColorMapper,
  ) => DecorationAttrs,
): DecorationSet => {
  const decorations: Decoration[] = [];

  const remoteStates = pluginState.remoteStates;
  for (const remoteState of remoteStates) {
    if (remoteState.cursor != null) {
      const user = remoteState.user;
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
            () => createCursor(user, pluginState.me, pluginState.colorMapper),
            {
              key: remoteState.clientId + user.id + user.name,
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
            createSelection(user, pluginState.me, pluginState.colorMapper),
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
  {
    cursorBuilder = defaultCursorBuilder,
    selectionBuilder = defaultSelectionBuilder,
  }: {
    cursorBuilder?: (
      user: User,
      me: User,
      colorMapper: ColorMapper,
    ) => HTMLElement;
    selectionBuilder?: (
      user: User,
      me: User,
      colorMapper: ColorMapper,
    ) => DecorationAttrs;
  } = {},
) => {
  return new Plugin<RemoteSelectionState>({
    key: remoteSelectionPluginKey,
    state: {
      init() {
        return {
          remoteStates: [],
          me: generateBlankUser(),
          colorMapper: defaultColorMapper,
        };
      },
      apply(tr, pluginState) {
        const changeUser = tr.getMeta('changeUser');
        if (changeUser) {
          pluginState.me = { ...changeUser.user };
        }
        const setColorMapper = tr.getMeta('setColorMapper');
        if (setColorMapper) {
          pluginState.colorMapper = setColorMapper.colorMapper;
        }

        const remoteSelectionChange = tr.getMeta('remoteSelectionChange');
        if (remoteSelectionChange) {
          pluginState.remoteStates = [...remoteSelectionChange.remoteStates];
        }

        return pluginState;
      },
    },
    props: {
      decorations(state) {
        const pluginState = this.getState(state);
        if (!pluginState) {
          return DecorationSet.empty;
        }
        return createDecorations(
          state,
          pluginState,
          cursorBuilder,
          selectionBuilder,
        );
      },
    },
  });
};
