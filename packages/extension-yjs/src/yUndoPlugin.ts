import { EditorState, Plugin } from 'prosemirror-state';
import { ContentType, Item, Text, UndoManager, XmlElement } from 'yjs';
import * as Y from 'yjs';

import type { Command } from '@kerebron/editor/commands';

import { ySyncPluginKey, yUndoPluginKey } from './keys.ts';
import { getRelativeSelection } from './ui/selection.ts';
import { YjsData } from './binding/PmYjsBinding.ts';
import { YSyncPluginState } from './ySyncPlugin.ts';

export interface UndoPluginState {
  xmlFragment?: Y.XmlFragment;
  undoManager?: UndoManager;
  prevSel?: ReturnType<typeof getRelativeSelection>;
  hasUndoOps: boolean;
  hasRedoOps: boolean;
}

export const undo: Command = (state: EditorState): boolean => {
  const tr = state.tr;
  tr.setMeta('preventDispatch', true);
  return !!(yUndoPluginKey.getState(state)?.undoManager?.undo());
};

export const redo: Command = (state: EditorState): boolean => {
  const tr = state.tr;
  tr.setMeta('preventDispatch', true);
  return !!(yUndoPluginKey.getState(state)?.undoManager?.redo());
};

export const undoCommand: Command = (state, dispatch) =>
  !dispatch
    ? !!(yUndoPluginKey.getState(state)?.undoManager?.canUndo())
    : undo(state);

export const redoCommand: Command = (state, dispatch) =>
  !dispatch
    ? !!(yUndoPluginKey.getState(state)?.undoManager?.canRedo())
    : redo(state);

export const defaultProtectedNodes = new Set(['paragraph']);

export const defaultDeleteFilter = (
  item: Y.Item,
  protectedNodes: Set<string>,
): boolean =>
  !(item instanceof Item) ||
  !(item.content instanceof ContentType) ||
  !(item.content.type instanceof Text ||
    (item.content.type instanceof XmlElement &&
      protectedNodes.has(item.content.type.nodeName))) ||
  item.content.type._length === 0;

export const yUndoPlugin = ({
  protectedNodes = defaultProtectedNodes,
  trackedOrigins = [],
}: {
  protectedNodes?: Set<string>;
  trackedOrigins?: any[];
} = {}) =>
  new Plugin<UndoPluginState>({
    key: yUndoPluginKey,
    state: {
      init: (_initargs, _state) => {
        return {
          xmlFragment: undefined,
          undoManager: undefined,
          prevSel: undefined,
          hasUndoOps: false,
          hasRedoOps: false,
        };
      },
      apply: (tr, val: UndoPluginState, oldState, state) => {
        const clearYjs = tr.getMeta('clearYjs');
        if (clearYjs) {
          const undoManager = val.undoManager;
          if (undoManager) {
            undoManager?.destroy();
          }

          return {
            xmlFragment: undefined,
            undoManager: undefined,
            prevSel: undefined,
            hasUndoOps: false,
            hasRedoOps: false,
          };
        }

        const setYjs: YjsData | undefined = tr.getMeta('setYjs');
        if (setYjs) {
          const { xmlFragment } = setYjs;
          const undoManager = new UndoManager(xmlFragment, {
            trackedOrigins: new Set([ySyncPluginKey].concat(trackedOrigins)),
            deleteFilter: (item) => defaultDeleteFilter(item, protectedNodes),
            captureTransaction: (ytr) => {
              return ytr.meta.get('addToYjsHistory') !== false;
            },
          });

          const ystate: YSyncPluginState = ySyncPluginKey.getState(oldState)!;
          undoManager.on('stack-item-added', ({ stackItem }) => {
            const yUndoPluginState = yUndoPluginKey.getState(oldState);
            const binding = ystate.binding;
            if (binding && yUndoPluginState) {
              stackItem.meta.set(
                binding,
                yUndoPluginState.prevSel,
              );
            }
          });
          undoManager.on('stack-item-popped', ({ stackItem }) => {
            const binding = ystate.binding;
            if (binding) {
              const beforeTransactionSelection = stackItem.meta.get(binding);
              if (beforeTransactionSelection) {
                const selectionStash = binding.getSelectionStash();
                if (selectionStash) {
                  selectionStash.overwrite(beforeTransactionSelection);
                }
              }
            }
          });

          return {
            undoManager,
            xmlFragment,
            prevSel: undefined,
            hasUndoOps: undoManager.undoStack.length > 0,
            hasRedoOps: undoManager.redoStack.length > 0,
          };
        }

        if (val.undoManager && val.xmlFragment) {
          const undoManager = val.undoManager;
          const hasUndoOps = undoManager.undoStack.length > 0;
          const hasRedoOps = undoManager.redoStack.length > 0;

          const ystate = ySyncPluginKey.getState(state)!;
          const binding = ystate.binding;
          if (binding) {
            return {
              ...val,
              prevSel: getRelativeSelection(
                val.xmlFragment,
                binding.getMapping(),
                oldState,
              ),
              hasUndoOps,
              hasRedoOps,
            };
          }

          if (hasUndoOps !== val.hasUndoOps || hasRedoOps !== val.hasRedoOps) {
            return {
              ...val,
              hasUndoOps: undoManager.undoStack.length > 0,
              hasRedoOps: undoManager.redoStack.length > 0,
            };
          }
        }
        return val;
      },
    },
    view: (view) => {
      return {
        destroy: () => {
          const yUndoPluginState = yUndoPluginKey.getState(view.state);
          const undoManager = yUndoPluginState?.undoManager;
          undoManager?.destroy();
        },
      };
    },
  });
