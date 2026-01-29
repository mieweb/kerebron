import * as Y from 'yjs';
import { Plugin } from 'prosemirror-state';

import { ySyncPluginKey, yUndoPluginKey } from './keys.ts';
import { defaultColors, ProsemirrorBinding } from './ProsemirrorBinding.ts';
import { Schema } from 'prosemirror-model';
import type { CreateWsProvider, YjsProvider } from './ExtensionYjs.ts';

export type TransactFunc<T> = (
  f: (arg0?: Y.Transaction) => T,
  origin?: any,
) => T;

export const isVisible = (item: Y.Item, snapshot: Y.Snapshot) =>
  snapshot === undefined ? !item.deleted : (snapshot.sv.has(item.id.client) &&
    (snapshot.sv.get(item.id.client)!) > item.id.clock &&
    !Y.isDeleted(snapshot.ds, item.id));

export interface ColorDef {
  light: string;
  dark: string;
}

interface YSyncOpts {
  colors?: Array<ColorDef>;
  colorMapping?: Map<string, ColorDef>;
  permanentUserData?: Y.PermanentUserData;
  onFirstRender?: () => void;
  roomId?: string;
}

export interface YSyncPluginState {
  roomId: string;
  provider?: YjsProvider;
  type: Y.XmlFragment;
  ydoc: Y.Doc;

  binding: ProsemirrorBinding;
  addToHistory: boolean;
  isChangeOrigin: boolean;
  restore: any;
  snapshot?: Y.Snapshot;
  prevSnapshot?: Y.Snapshot;
  isUndoRedoOperation: boolean;
  colors: Array<ColorDef>;
  colorMapping: Map<string, ColorDef>;
  permanentUserData?: Y.PermanentUserData;
}

/**
 * This plugin listens to changes in prosemirror view and keeps yXmlState and view in sync.
 *
 * This plugin also keeps references to the type and the shared document so other plugins can access it.
 */
export const ySyncPlugin = (
  schema: Schema,
  createWsProvider: CreateWsProvider,
  {
    colors = defaultColors,
    colorMapping = new Map(),
    onFirstRender = () => {
    },
  }: YSyncOpts = {},
): any => {
  let initialContentChanged = false;
  const plugin: Plugin<YSyncPluginState> = new Plugin<YSyncPluginState>({
    props: {
      // editable: (state) => {
      //   const syncState = ySyncPluginKey.getState(state)!;
      //   return syncState.snapshot && syncState.prevSnapshot;
      // },
    },
    key: ySyncPluginKey,
    state: {
      init: (_initargs, state): YSyncPluginState => {
        const ydoc = new Y.Doc();
        const yXmlFragment: Y.XmlFragment = ydoc.getXmlFragment('prosemirror');
        const mapping = new Map();
        const binding = new ProsemirrorBinding(yXmlFragment, mapping);

        return {
          roomId: '',
          provider: undefined,
          binding,
          type: yXmlFragment,
          ydoc: ydoc,
          snapshot: undefined,
          prevSnapshot: undefined,
          isChangeOrigin: false,
          isUndoRedoOperation: false,
          addToHistory: true,
          restore: undefined,
          colors,
          colorMapping,
          permanentUserData: undefined,
        };
      },
      apply: (tr, pluginState: YSyncPluginState) => {
        const change: Partial<YSyncPluginState> = tr.getMeta(ySyncPluginKey);
        if (change !== undefined) {
          pluginState = {
            ...pluginState,
            ...change,
          };

          if ('roomId' in change) {
            if (change.roomId) {
              const [provider, ydoc] = createWsProvider(change.roomId);
              pluginState.provider = provider;
              const yXmlFragment: Y.XmlFragment = ydoc.getXmlFragment(
                'prosemirror',
              );
              pluginState.type = yXmlFragment, pluginState.ydoc = ydoc;

              if (pluginState.provider) {
                if (pluginState.binding.prosemirrorView) {
                  const view = pluginState.binding.prosemirrorView;
                  const tr = view.state.tr.setMeta(
                    'yjs:awareness',
                    pluginState.provider.awareness,
                  );
                  view.dispatch(tr);
                }
              }
            } else {
              const ydoc = new Y.Doc();
              const yXmlFragment: Y.XmlFragment = ydoc.getXmlFragment(
                'prosemirror',
              );
              pluginState.type = yXmlFragment, pluginState.ydoc = ydoc;
              pluginState.provider = undefined;
            }
            pluginState.snapshot = undefined;
            pluginState.prevSnapshot = undefined;
            pluginState.isChangeOrigin = false;
            pluginState.isUndoRedoOperation = false;
            pluginState.addToHistory = true;
            pluginState.restore = undefined;

            initialContentChanged = false;

            pluginState.binding.changeRoom(pluginState.type);
            setTimeout(() => {
              pluginState.binding._forceRerender();
            }, 0);

            return pluginState;
          }
        }

        pluginState.addToHistory = tr.getMeta('addToHistory') !== false;
        // always set isChangeOrigin. If undefined, this is not change origin.
        pluginState.isChangeOrigin = !!change?.isChangeOrigin;
        pluginState.isUndoRedoOperation = !!change?.isChangeOrigin &&
          !!change?.isUndoRedoOperation;

        const binding = pluginState.binding;

        if (binding?.prosemirrorView) {
          if (change?.snapshot || change?.prevSnapshot) {
            // snapshot changed, rerender next
            setTimeout(() => {
              if (!binding.prosemirrorView) {
                return;
              }
              if (change.restore == null) {
                binding._renderSnapshot(
                  change.snapshot,
                  change.prevSnapshot,
                  pluginState,
                );
              } else {
                binding._renderSnapshot(
                  change.snapshot,
                  change.snapshot,
                  pluginState,
                );
                // reset to current prosemirror state
                delete pluginState.restore;
                delete pluginState.snapshot;
                delete pluginState.prevSnapshot;
                initialContentChanged = false;
                binding.mux(() => {
                  if (!binding.prosemirrorView) {
                    return;
                  }
                  binding.prosemirrorChanged(
                    binding.prosemirrorView.state.doc,
                  );
                });
              }
            }, 0);
          }
        }
        return pluginState;
      },
    },
    view: (view) => {
      const pluginState: YSyncPluginState = ySyncPluginKey.getState(
        view.state,
      )!;
      const binding = pluginState.binding;

      binding.initView(view);
      if (binding.mapping == null) {
        // force rerender to update the bindings mapping
        binding._forceRerender();
      }
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
            !pluginState.snapshot && !pluginState.prevSnapshot
          ) {
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
                pluginState.addToHistory === false &&
                !pluginState.isChangeOrigin
              ) {
                const yUndoPluginState = yUndoPluginKey.getState(view.state);
                if (yUndoPluginState?.undoManager) {
                  yUndoPluginState.undoManager.stopCapturing();
                }
              }
              binding.mux(() => {
                if (!pluginState.ydoc) {
                  return;
                }
                pluginState.ydoc.transact((tr) => {
                  tr.meta.set('addToHistory', pluginState.addToHistory);
                  binding.prosemirrorChanged(view.state.doc);
                }, ySyncPluginKey);
              });
            }
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
