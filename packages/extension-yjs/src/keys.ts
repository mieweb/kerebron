import { PluginKey } from 'prosemirror-state';
import { UndoPluginState } from './yUndoPlugin.ts';

/**
 * The unique prosemirror plugin key for syncPlugin
 */
export const ySyncPluginKey = new PluginKey('y-sync');

/**
 * The unique prosemirror plugin key for undoPlugin
 */
export const yUndoPluginKey: PluginKey<UndoPluginState> = new PluginKey(
  'y-undo',
);

/**
 * The unique prosemirror plugin key for cursorPlugin
 */
export const yCursorPluginKey = new PluginKey('yjs-cursor');
