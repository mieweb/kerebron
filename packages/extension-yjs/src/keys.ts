import { PluginKey } from 'prosemirror-state';
import { type UndoPluginState } from './yUndoPlugin.ts';
import { type YSyncPluginState } from './ySyncPlugin.ts';
import { type YPositionPluginState } from './yPositionPlugin.ts';

export const ySyncPluginKey = new PluginKey<YSyncPluginState>('y-sync');

export const yPositionPluginKey = new PluginKey<YPositionPluginState>(
  'yjs-position',
);

export const yUndoPluginKey = new PluginKey<UndoPluginState>(
  'y-undo',
);
