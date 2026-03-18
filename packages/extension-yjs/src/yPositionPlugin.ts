import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { EditorState, Plugin, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { CoreEditor } from '@kerebron/editor';
import {
  type ColorMapper,
  defaultColorMapper,
  generateBlankUser,
  type User,
} from '@kerebron/editor/user';
import type { SelectionState } from '@kerebron/extension-basic-editor/ExtensionRemoteSelection';

import { yPositionPluginKey, ySyncPluginKey } from './keys.ts';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from './position.ts';
import type { YSyncPluginState } from './ySyncPlugin.ts';

/**
 * Is null if no timeout is in progress.
 * Is defined if a timeout is in progress.
 * Maps from view
 */
let viewsToUpdate: Map<EditorView, Map<any, any>> | null = null;

const updateMetas = () => {
  const ups: Map<EditorView, Map<any, any>> | null = viewsToUpdate;
  viewsToUpdate = null;
  if (!ups) {
    return;
  }
  ups.forEach((metas, view) => {
    const tr = view.state.tr;
    const syncState = ySyncPluginKey.getState(view.state);
    if (syncState && syncState.binding) { //  && !syncState.binding.isDestroyed
      metas.forEach((val, key) => {
        tr.setMeta(key, val);
      });
      view.dispatch(tr);
    }
  });
};

export const setMeta = <K, V>(view: EditorView, key: K, value: V) => {
  if (!viewsToUpdate) {
    viewsToUpdate = new Map<EditorView, Map<K, V>>();
    setTimeout(updateMetas, 0);
  }

  let subMap = viewsToUpdate.get(view);
  if (subMap === undefined) {
    subMap = new Map<K, V>();
    viewsToUpdate.set(view, subMap);
  }
  subMap.set(key, value);
};

type AwarenessListener = (
  { added, updated, removed }: {
    added: number[];
    updated: number[];
    removed: number[];
  },
  s: any,
  t: any,
) => void;

interface PositionPluginConfig {
  getSelection?: (arg0: any) => any;
}

export interface YPositionPluginState {
  awareness?: Awareness;
  awarenessListener?: AwarenessListener;
  cursorStateField: string;
  userStateField: string;
  me: User;
  colorMapper: ColorMapper;
}

function destroyAwareness(
  pluginState: YPositionPluginState,
) {
  if (!pluginState.awareness) {
    return;
  }
  const awareness = pluginState.awareness;
  if (pluginState.awarenessListener) {
    awareness.off('change', pluginState.awarenessListener);
  }
  awareness.setLocalStateField(pluginState.cursorStateField, null);
  pluginState.awareness = undefined;
}

function initAwareness(state: YPositionPluginState, editor: CoreEditor) {
  if (!state.awareness) {
    return;
  }
  const awareness = state.awareness;
  const view = editor.view as EditorView;

  state.awarenessListener = (
    { added, updated, removed },
  ) => {
    const ystate: YSyncPluginState = ySyncPluginKey.getState(view.state)!;
    if (!ystate.binding) {
      return;
    }
    const yjs = ystate.binding.getYjs();
    if (!yjs) {
      return;
    }

    const clients = added.concat(updated).concat(removed);
    if (
      clients.findIndex((id: number) => id !== awareness.doc.clientID) ===
        -1
    ) {
      return;
    }

    const remoteStates: SelectionState[] = [];

    const { ydoc, xmlFragment } = yjs;

    awareness.getStates().forEach((aw, clientId) => {
      if (!defaultAwarenessStateFilter(ydoc.clientID, clientId, aw)) {
        return;
      }

      const cursor = aw[state.cursorStateField];
      const user: User | undefined = aw[state.userStateField];

      if (!cursor || !user) {
        return;
      }

      const anchor = relativePositionToAbsolutePosition(
        ydoc,
        xmlFragment,
        Y.createRelativePositionFromJSON(cursor.anchor),
        ystate.binding.getMapping(),
      );
      const head = relativePositionToAbsolutePosition(
        ydoc,
        xmlFragment,
        Y.createRelativePositionFromJSON(cursor.head),
        ystate.binding.getMapping(),
      );

      if (anchor !== null && head !== null) {
        remoteStates.push({
          clientId,
          user: user,
          cursor: {
            anchor,
            head,
          },
        });
      }
    });

    const tr = editor.state.tr;
    tr.setMeta('remoteSelectionChange', { remoteStates });
    editor.dispatchTransaction(tr);
  };

  awareness.on('change', state.awarenessListener);
}

/**
 * Default awareness state filter
 */
export const defaultAwarenessStateFilter = (
  currentClientId: number,
  userClientId: number,
  _user: any,
): boolean => currentClientId !== userClientId;

export const yPositionPlugin = (
  editor: CoreEditor,
  {
    getSelection = (state: EditorState) => state.selection,
  }: PositionPluginConfig = {},
) => {
  return new Plugin<YPositionPluginState>({
    key: yPositionPluginKey,
    state: {
      init: (): YPositionPluginState => {
        return {
          awareness: undefined,
          cursorStateField: 'kerebron:cursor',
          userStateField: 'kerebron:user',
          me: generateBlankUser(),
          colorMapper: defaultColorMapper,
        };
      },
      apply: (tr: Transaction, pluginState: YPositionPluginState) => {
        const changeUser = tr.getMeta('changeUser');
        if (changeUser) {
          pluginState.me = { ...changeUser.user };
        }
        const setColorMapper = tr.getMeta('setColorMapper');
        if (setColorMapper) {
          pluginState.colorMapper = setColorMapper.colorMapper;
        }

        const awareness = tr.getMeta('yjs:setAwareness');
        if (awareness) {
          if (pluginState.awareness) {
            destroyAwareness(pluginState);
          }
          pluginState.awareness = awareness;
          if (pluginState.awareness) {
            initAwareness(pluginState, editor);
          }
        }

        if (tr.getMeta('yjs:removeAwareness')) {
          if (pluginState.awareness) {
            destroyAwareness(pluginState);
          }
        }
        return pluginState;
      },
    },
    view: (view: EditorView) => {
      const updateAwareness = (
        selectionAnchor: number,
        selectionHead: number,
      ) => {
        const state: YPositionPluginState = yPositionPluginKey.getState(
          view.state,
        )!;
        if (!state.awareness) {
          return;
        }
        const awareness = state.awareness;
        const current = awareness.getLocalState() || {};

        const ystate: YSyncPluginState = ySyncPluginKey.getState(view.state)!;
        const yjs = ystate.binding.getYjs();
        if (!yjs) {
          return;
        }
        const { xmlFragment } = yjs;

        const anchor: Y.RelativePosition = absolutePositionToRelativePosition(
          selectionAnchor,
          xmlFragment,
          ystate.binding.getMapping(),
        );
        const head: Y.RelativePosition = absolutePositionToRelativePosition(
          selectionHead,
          xmlFragment,
          ystate.binding.getMapping(),
        );

        const cursor = current[state.cursorStateField];

        if (
          cursor == null ||
          !Y.compareRelativePositions(
            Y.createRelativePositionFromJSON(cursor.anchor),
            anchor,
          ) ||
          !Y.compareRelativePositions(
            Y.createRelativePositionFromJSON(cursor.head),
            head,
          )
        ) {
          awareness.setLocalStateField(state.cursorStateField, {
            anchor,
            head,
          });
        }
      };

      const clearAwareness = () => {
        const state: YPositionPluginState = yPositionPluginKey.getState(
          view.state,
        )!;
        if (!state.awareness) {
          return;
        }

        const ystate: YSyncPluginState = ySyncPluginKey.getState(view.state)!;
        const yjs = ystate.binding.getYjs();
        if (!yjs) {
          return;
        }

        const awareness = state.awareness;
        const current = awareness.getLocalState() || {};

        const { ydoc, xmlFragment } = yjs;

        const cursor = current[state.cursorStateField];

        if (
          cursor &&
          relativePositionToAbsolutePosition(
              ydoc,
              xmlFragment,
              Y.createRelativePositionFromJSON(cursor.anchor),
              ystate.binding.getMapping(),
            ) !== null
        ) {
          // delete cursor information if current cursor information is owned by this editor binding
          awareness.setLocalStateField(state.cursorStateField, null);
        }
      };

      const updateCursorInfo = () => {
        if (view.hasFocus()) {
          const selection = getSelection(view.state);
          updateAwareness(selection.anchor, selection.head);
        } else {
          // clearAwareness();
        }
      };

      const localPositionChangedListener = (event: Event) => {
        if ('detail' in event) {
          const { detail } = event as CustomEvent;
          updateAwareness(detail.anchor, detail.head);
        }
      };

      editor.addEventListener(
        'localPositionChanged',
        localPositionChangedListener,
      );

      view.dom.addEventListener('focusin', updateCursorInfo);
      view.dom.addEventListener('focusout', updateCursorInfo);

      return {
        update: updateCursorInfo,
        destroy: () => {
          view.dom.removeEventListener('focusin', updateCursorInfo);
          view.dom.removeEventListener('focusout', updateCursorInfo);

          const pluginState: YPositionPluginState | undefined =
            yPositionPluginKey.getState(
              view.state,
            );
          if (pluginState) {
            destroyAwareness(pluginState);
          }

          editor.removeEventListener(
            'localPositionChanged',
            localPositionChangedListener,
          );
        },
      };
    },
    updateCursorInfo(state: EditorState) {
      throw new Error('TODO: merge with updateCursorInfo above');
    },
  });
};
