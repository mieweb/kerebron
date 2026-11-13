import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import * as Y from 'yjs';

import { Extension } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandFactory,
  CommandShortcuts,
} from '@kerebron/editor/commands';

import { icons } from '@kerebron/ui/icons';
import { Ui } from '@kerebron/ui';

import { ySyncPlugin } from './ySyncPlugin.ts';
import { yPositionPlugin } from './yPositionPlugin.ts';
import { redoCommand, undoCommand, yUndoPlugin } from './yUndoPlugin.ts';
import { ySyncPluginKey } from './keys.ts';

import type { CreateYjsProvider } from './YjsProvider.ts';
import { TemplatesRegistry } from '@kerebron/ui/templates';
import { RoomController } from '@kerebron/yjs/ui/RoomController';

export interface YjsConfig {
  createYjsProvider?: CreateYjsProvider;
  addMenu?: boolean;
}

export class ExtensionYjs extends Extension {
  name = 'yjs';

  override overrides = ['history'];
  requires = ['remote-selection'];

  constructor(public override config: YjsConfig) {
    super();
  }

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

  override getProseMirrorPlugins(): Plugin[] {
    return [
      ySyncPlugin(this.editor, this.config.createYjsProvider),
      yPositionPlugin(this.editor),
      yUndoPlugin(),
    ];
  }

  override created(): void {
    if (this.config.addMenu) {
      const ui: Ui = this.editor.ci.resolve('ui');

      const controller = new RoomController();

      this.editor.addEventListener('ready', () => {
        const menuFile = {
          type: 'item',
          id: 'yjs-room',
          title: 'YJS Room',
          icon: icons.user,
          action: async (_editor) => {
            const popup = ui.createPopup({
              anchorId: '--menuitem-more-tools',
              layer: 'toplayer',
              group: 'menu',
            });
            popup.addEventListener('remove', () => {
              // popup = undefined;
            });

            controller.bindEvents(popup);
            await controller.init();

            const templates: TemplatesRegistry = this.editor.ci.resolve(
              'templates',
            );

            const renderForm = () => {
              ui.setPopupContent(
                popup,
                templates['room-selector'](controller),
              );
            };

            renderForm();

            controller.addEventListener('change-room', (event) => {
              renderForm();
              popup.remove();
            });
            controller.addEventListener('change-user', (event) => {
              renderForm();
              popup.remove();
            });

            return true;
          },
        };

        this.editor.run.addMenuItem(menuFile, 0, 'tray');
      });
    }
  }
}
