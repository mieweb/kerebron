import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { EditorState, Plugin, PluginKey } from 'prosemirror-state';

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
import { ySyncPluginKey } from './keys.ts';

export const yPositionPluginKey = new PluginKey('yjs-position');

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

/**
 * Default awareness state filter
 */
export const defaultAwarenessStateFilter = (
  currentClientId: number,
  userClientId: number,
  _user: any,
): boolean => currentClientId !== userClientId;

export const yPositionPlugin = (
  awareness: awarenessProtocol.Awareness,
  editor: CoreEditor,
  {
    getSelection = (state: EditorState) => state.selection,
  }: PositionPluginConfig = {},
  cursorStateField: string = 'cursor',
) => {
  return new Plugin({
    key: yPositionPluginKey,
    view: (view) => {
      const extension: ExtensionRemoteSelection = editor.getExtension(
        'remote-selection',
      )!;

      const awarenessListener: AwarenessListener = (
        { added, updated, removed },
      ) => {
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

        const ystate = ySyncPluginKey.getState(view.state);
        const y = ystate.doc;

        awareness.getStates().forEach((aw, clientId) => {
          if (!defaultAwarenessStateFilter(y.clientID, clientId, aw)) {
            return;
          }

          if (!aw.cursor) {
            return;
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

        extension.setRemoteStates(remoteStates);
        // view.dispatch({ annotations: [yRemoteSelectionsAnnotation.of([])] });
      };

      {
        // if (
        //   ystate.snapshot != null || ystate.prevSnapshot != null ||
        //   ystate.binding.mapping.size === 0
        // ) {
        //   // do not render cursors while snapshot is active
        //   return DecorationSet.create(state.doc, []);
        // }
      }

      const updateAwareness = (
        selectionAnchor: number,
        selectionHead: number,
      ) => {
        const ystate = ySyncPluginKey.getState(view.state);
        const current = awareness.getLocalState() || {};

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
        const ystate = ySyncPluginKey.getState(view.state);
        const current = awareness.getLocalState() || {};

        if (
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

      const updateCursorInfo = () => {
        if (view.hasFocus()) {
          const selection = getSelection(view.state);
          updateAwareness(selection.anchor, selection.head);
        } else {
          // clearAwareness();
        }
      };

      const localPositionChangedListener = (event: CustomEvent) => {
        const { detail } = event;
        updateAwareness(detail.anchor, detail.head);
      };

      editor.addEventListener(
        'localPositionChanged',
        localPositionChangedListener,
      );

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
