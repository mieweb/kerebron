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
import { redoCommand, undoCommand, yUndoPlugin } from './yUndoPlugin.ts';
import { ySyncPluginKey } from './keys.ts';

import type { CreateYjsProvider } from './YjsProvider.ts';

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

    const getYDoc: CommandFactory = (
      { resolve, reject }: {
        resolve: (doc: Y.Doc) => void;
        reject: (reason: any) => void;
      },
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { getYDoc: { resolve, reject } });
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      };
    };

    const getYSnapshot: CommandFactory = (
      { resolve, reject }: {
        resolve: (snapshot: Uint8Array) => void;
        reject: (reason: any) => void;
      },
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { getYSnapshot: { resolve, reject } });
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      };
    };

    const setYSnapshot: CommandFactory = (
      opts: { prevSnapshot: Uint8Array; snapshot: Uint8Array },
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { setYSnapshot: opts });
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      };
    };

    const resetYSnapshot: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(ySyncPluginKey, { resetYSnapshot: true });
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      };
    };

    return {
      getYDoc,
      changeRoom,
      leaveRoom,
      'undo': () => undoCommand,
      'redo': () => redoCommand,
      getYSnapshot,
      setYSnapshot,
      resetYSnapshot,
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
      ySyncPlugin(this.editor, this.config.createYjsProvider),
      yPositionPlugin(this.editor),
      yUndoPlugin(),
    ];
  }
}
