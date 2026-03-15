import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import * as Y from 'yjs';

import { Extension } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandFactory,
  CommandShortcuts,
} from '@kerebron/editor/commands';

import { ySyncPlugin } from './ySyncPlugin.ts';
import { yPositionPlugin } from './yPositionPlugin.ts';
import { redo, undo, yUndoPlugin } from './yUndoPlugin.ts';
import { ySyncPluginKey } from './keys.ts';

import type { YjsProvider } from './YjsProvider.ts';
export type { YjsProvider } from './YjsProvider.ts';

export type CreateYjsProvider = (roomId: string) => [YjsProvider, Y.Doc];

export interface YjsConfig {
  createYjsProvider: CreateYjsProvider;
}

export class ExtensionYjs extends Extension {
  name = 'yjs';

  override conflicts = ['history'];
  requires = ['remote-selection'];

  override getCommandFactories(): Partial<CommandFactories> {
    const changeRoom: CommandFactory = (roomId: string) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { changeRoom: { roomId } });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const leaveRoom: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { leaveRoom: true });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      'changeRoom': changeRoom,
      'leaveRoom': leaveRoom,
      'undo': () => undo,
      'redo': () => redo,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-z': 'undo',
      'Mod-y': 'redo',
    };
  }

  constructor(public override config: YjsConfig) {
    super();
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      ySyncPlugin(this.editor.schema, this.config.createYjsProvider),
      yPositionPlugin(this.editor),
      yUndoPlugin(),
    ];
  }
}
