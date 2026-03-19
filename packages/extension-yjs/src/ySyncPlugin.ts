import * as Y from 'yjs';
import { Plugin } from 'prosemirror-state';

import { ySyncPluginKey, yUndoPluginKey } from './keys.ts';
import type { CreateYjsProvider } from './YjsProvider.ts';
import { PmYjsBinding } from './binding/PmYjsBinding.ts';
import { CoreEditor } from '@kerebron/editor';

interface YSyncOpts {
  permanentUserData?: Y.PermanentUserData;
  onFirstRender?: () => void;
  roomId?: string;
}

export interface YSyncPluginState {
  binding: PmYjsBinding;
  isChangeOrigin: boolean;
  isUndoRedoOperation: boolean; // Used in y-history.test.ts
  permanentUserData?: Y.PermanentUserData;
}

interface YSyncMeta {
  getYDoc?: {
    resolve: (doc: Y.Doc) => void;
    reject: (reason: any) => void;
  };
  changeRoom?: {
    roomId: string;
  };
  leaveRoom?: boolean;
  isChangeOrigin?: boolean;
  isUndoRedoOperation?: boolean;
  restore?: any;
}

/**
 * This plugin listens to changes in prosemirror view and keeps yXmlState and view in sync.
 *
 * This plugin also keeps references to the type and the shared document so other plugins can access it.
 */
export const ySyncPlugin = (
  editor: CoreEditor,
  createYjsProvider: CreateYjsProvider,
  {
    onFirstRender = () => {
    },
  }: YSyncOpts = {},
): any => {
  let initialContentChanged = false;
  const plugin: Plugin<YSyncPluginState> = new Plugin<YSyncPluginState>({
    props: {
      editable: (state) => {
        return true;
      },
    },
    key: ySyncPluginKey,
    state: {
      init: (_initargs, state): YSyncPluginState => {
        return {
          binding: new PmYjsBinding(editor),
          isChangeOrigin: false,
          isUndoRedoOperation: false,
          permanentUserData: undefined,
        };
      },
      apply: (tr, pluginState: YSyncPluginState) => {
        const pluginMeta: Partial<YSyncMeta> = tr.getMeta(ySyncPluginKey);

        const changeUser = tr.getMeta('changeUser');
        if (changeUser) {
          pluginState.binding.changeUser(changeUser.user);
        }

        if (pluginMeta?.getYDoc) {
          const yjs = pluginState.binding.getYjs();
          if (yjs) {
            pluginMeta.getYDoc.resolve(yjs.ydoc);
          } else {
            if (pluginMeta.getYDoc.reject) {
              pluginMeta.getYDoc.reject(new Error('No yjs'));
            } else {
              throw new Error('No yjs');
            }
          }
          return pluginState;
        }

        if (pluginMeta?.leaveRoom) {
          pluginState.isChangeOrigin = false;
          pluginState.isUndoRedoOperation = false;

          initialContentChanged = false;

          pluginState.binding.leaveRoom(tr);

          return pluginState;
        }

        if (pluginMeta?.changeRoom) {
          pluginState.isChangeOrigin = false;
          pluginState.isUndoRedoOperation = false;

          initialContentChanged = false;

          const roomId = pluginMeta.changeRoom.roomId;
          pluginState.binding.changeRoom(
            roomId,
            createYjsProvider,
            tr,
          );

          return pluginState;
        }

        pluginState.binding.addToYjsHistory =
          tr.getMeta('addToYjsHistory') !== false;
        // always set isChangeOrigin. If undefined, this is not change origin.
        pluginState.isChangeOrigin = !!pluginMeta?.isChangeOrigin;
        pluginState.isUndoRedoOperation = !!pluginMeta?.isChangeOrigin &&
          !!pluginMeta?.isUndoRedoOperation;

        return pluginState;
      },
    },
    view: (view) => {
      const pluginState: YSyncPluginState = ySyncPluginKey.getState(
        view.state,
      )!;
      const binding = pluginState.binding;

      onFirstRender();
      return {
        update: () => {
          const pluginState: YSyncPluginState | undefined = plugin.getState(
            view.state,
          );
          if (!pluginState) {
            return;
          }

          const binding = pluginState.binding;
          if (
            // If the content doesn't change initially, we don't render anything to Yjs
            // If the content was cleared by a user action, we want to catch the change and
            // represent it in Yjs
            initialContentChanged ||
            view.state.doc.content.findDiffStart(
                view.state.doc.type.createAndFill()!.content,
              ) !== null
          ) {
            initialContentChanged = true;
            if (
              pluginState.binding.addToYjsHistory === false &&
              !pluginState.isChangeOrigin
            ) {
              const yUndoPluginState = yUndoPluginKey.getState(view.state);
              if (yUndoPluginState?.undoManager) {
                yUndoPluginState.undoManager.stopCapturing();
              }
            }

            binding.pmChanged();
          }
        },
        destroy: () => {
          binding.destroy();
        },
      };
    },
  });
  return plugin;
};
