import { EditorState, Plugin } from 'prosemirror-state';
import { ContentType, Item, Text, UndoManager, XmlElement } from 'yjs';

import type { Command } from '@kerebron/editor/commands';

import { ySyncPluginKey, yUndoPluginKey } from './keys.ts';
import { getRelativeSelection } from './ProsemirrorBinding.ts';

export interface UndoPluginState {
  undoManager: UndoManager;
  prevSel: ReturnType<typeof getRelativeSelection> | null;
  hasUndoOps: boolean;
  hasRedoOps: boolean;
}

export const undo = (state: EditorState): boolean =>
  yUndoPluginKey.getState(state)?.undoManager?.undo() != null;

export const redo = (state: EditorState): boolean =>
  yUndoPluginKey.getState(state)?.undoManager?.redo() != null;

export const undoCommand: Command = (state, dispatch) =>
  dispatch == null
    ? yUndoPluginKey.getState(state)?.undoManager?.canUndo()
    : undo(state);

export const redoCommand: Command = (state, dispatch) =>
  dispatch == null
    ? yUndoPluginKey.getState(state)?.undoManager?.canRedo()
    : redo(state);

export const defaultProtectedNodes = new Set(['paragraph']);

export const defaultDeleteFilter = (
  item: import('yjs').Item,
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
  undoManager = null,
}: {
  protectedNodes?: Set<string>;
  trackedOrigins?: any[];
  undoManager?: import('yjs').UndoManager | null;
} = {}) =>
  new Plugin({
    key: yUndoPluginKey,
    state: {
      init: (initargs, state) => {
        // TODO: check if plugin order matches and fix
        const ystate = ySyncPluginKey.getState(state);
        const _undoManager = undoManager || new UndoManager(ystate.type, {
          trackedOrigins: new Set([ySyncPluginKey].concat(trackedOrigins)),
          deleteFilter: (item) => defaultDeleteFilter(item, protectedNodes),
          captureTransaction: (tr) => tr.meta.get('addToHistory') !== false,
        });
        return {
          undoManager: _undoManager,
          prevSel: null,
          hasUndoOps: _undoManager.undoStack.length > 0,
          hasRedoOps: _undoManager.redoStack.length > 0,
        };
      },
      apply: (tr, val, oldState, state) => {
        const binding = ySyncPluginKey.getState(state).binding;
        const undoManager = val.undoManager;
        const hasUndoOps = undoManager.undoStack.length > 0;
        const hasRedoOps = undoManager.redoStack.length > 0;
        if (binding) {
          return {
            undoManager,
            prevSel: getRelativeSelection(binding, oldState),
            hasUndoOps,
            hasRedoOps,
          };
        } else {
          if (hasUndoOps !== val.hasUndoOps || hasRedoOps !== val.hasRedoOps) {
            return Object.assign({}, val, {
              hasUndoOps: undoManager.undoStack.length > 0,
              hasRedoOps: undoManager.redoStack.length > 0,
            });
          } else { // nothing changed
            return val;
          }
        }
      },
    },
    view: (view) => {
      const ystate = ySyncPluginKey.getState(view.state);
      const yUndoPlugin = yUndoPluginKey.getState(view.state);
      const undoManager = yUndoPlugin?.undoManager;
      if (undoManager) {
        undoManager.on('stack-item-added', ({ stackItem }) => {
          const binding = ystate.binding;
          if (binding) {
            stackItem.meta.set(
              binding,
              yUndoPlugin.prevSel,
            );
          }
        });
        undoManager.on('stack-item-popped', ({ stackItem }) => {
          const binding = ystate.binding;
          if (binding) {
            binding.beforeTransactionSelection = stackItem.meta.get(binding) ||
              binding.beforeTransactionSelection;
          }
        });
      }
      return {
        destroy: () => {
          undoManager?.destroy();
        },
      };
    },
  });
