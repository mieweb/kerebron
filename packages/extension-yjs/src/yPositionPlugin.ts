import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

import { EditorState, Plugin, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { CoreEditor } from '@kerebron/editor';
import type {
  ExtensionRemoteSelection,
  SelectionState,
} from '@kerebron/extension-basic-editor/ExtensionRemoteSelection';
import { remoteSelectionPluginKey } from '@kerebron/extension-basic-editor/ExtensionRemoteSelection';

import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  setMeta,
} from './lib.ts';
import { yPositionPluginKey, ySyncPluginKey } from './keys.ts';
import type { YSyncPluginState } from './ySyncPlugin.ts';

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
}

function destroyAwareness(
  state: YPositionPluginState,
  cursorStateField: string,
) {
  if (!state.awareness) {
    return;
  }
  const awareness = state.awareness;
  if (state.awarenessListener) {
    awareness.off('change', state.awarenessListener);
  }
  awareness.setLocalStateField(cursorStateField, null);
}

function initAwareness(state: YPositionPluginState, editor: CoreEditor) {
  console.log('initAwareness', state.awareness);
  if (!state.awareness) {
    return;
  }
  const awareness = state.awareness;
  const view = editor.view as EditorView;

  state.awarenessListener = (
    { added, updated, removed },
  ) => {
    console.log('state.awarenessListener');
    const ystate: YSyncPluginState = ySyncPluginKey.getState(view.state)!;
    if (!ystate.provider) {
      return;
    }
    const awareness = ystate.provider.awareness;
    const clients = added.concat(updated).concat(removed);
    if (
      clients.findIndex((id: number) => id !== awareness.doc.clientID) ===
        -1
    ) {
      return;
    }

    if (view.docView) {
      setMeta(view, remoteSelectionPluginKey, {
        remotePositionUpdated: true,
      });
    }

    const remoteStates: SelectionState[] = [];

    const ydoc = ystate.ydoc;

    awareness.getStates().forEach((aw, clientId) => {
      if (!defaultAwarenessStateFilter(ydoc.clientID, clientId, aw)) {
        return;
      }

      if (!aw.cursor) {
        return;
      }

      const anchor = relativePositionToAbsolutePosition(
        ydoc,
        ystate.type,
        Y.createRelativePositionFromJSON(aw.cursor.anchor),
        ystate.binding.mapping,
      );
      const head = relativePositionToAbsolutePosition(
        ydoc,
        ystate.type,
        Y.createRelativePositionFromJSON(aw.cursor.head),
        ystate.binding.mapping,
      );

      if (anchor !== null && head !== null) {
        remoteStates.push({
          clientId,
          user: {
            name: aw.user?.name,
            color: aw.user?.color,
            colorLight: aw.user?.colorLight,
          },
          cursor: {
            anchor,
            head,
          },
        });
      }
    });
    const extension: ExtensionRemoteSelection = editor.getExtension(
      'remote-selection',
    )!;

    extension.setRemoteStates(remoteStates);
    // view.dispatch({ annotations: [yRemoteSelectionsAnnotation.of([])] });
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
  cursorStateField: string = 'cursor',
) => {
  return new Plugin<YPositionPluginState>({
    key: yPositionPluginKey,
    state: {
      init: (_initargs, state): YPositionPluginState => {
        return {
          awareness: undefined,
        };
      },
      apply: (tr: Transaction, pluginState: YPositionPluginState) => {
        const awareness = tr.getMeta('yjs:awareness');
        if (awareness) {
          if (pluginState.awareness) {
            destroyAwareness(pluginState, cursorStateField);
          }
          pluginState.awareness = awareness;
          if (pluginState.awareness) {
            initAwareness(pluginState, editor);
          }
        }
        return pluginState;
      },
    },
    view: (view: EditorView) => {
      // const ystate: YSyncPluginState = ySyncPluginKey.getState(view.state)!;
      // if (
      //   ystate.snapshot != null || ystate.prevSnapshot != null ||
      //   ystate.binding.mapping.size === 0
      // ) {
      //   // do not render cursors while snapshot is active
      //   return DecorationSet.empty;
      // }

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

        const anchor: Y.RelativePosition = absolutePositionToRelativePosition(
          selectionAnchor,
          ystate.type,
          ystate.binding.mapping,
        );
        const head: Y.RelativePosition = absolutePositionToRelativePosition(
          selectionHead,
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
        }
      };

      const clearAwareness = () => {
        const state: YPositionPluginState = yPositionPluginKey.getState(
          view.state,
        )!;
        if (!state.awareness) {
          return;
        }
        const awareness = state.awareness;

        const ystate = ySyncPluginKey.getState(view.state)!;
        const current = awareness.getLocalState() || {};

        if (
          current.cursor != null &&
          relativePositionToAbsolutePosition(
              ystate.ydoc,
              ystate.type,
              Y.createRelativePositionFromJSON(current.cursor.anchor),
              ystate.binding.mapping,
            ) !== null
        ) {
          // delete cursor information if current cursor information is owned by this editor binding
          awareness.setLocalStateField(cursorStateField, null);
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
            destroyAwareness(pluginState, cursorStateField);
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
