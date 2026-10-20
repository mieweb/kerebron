import { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import { createMenuPlugin, MenuMeta, MenuPluginKey } from './MenuPlugin.ts';
import { createDefaultMenuBar } from './defaultMenuBar.ts';
import { MenuNode } from './model.ts';

export class ExtensionMenuLegacy extends Extension {
  name = 'menu';

  override getCommandFactories(): Partial<CommandFactories> {
    const addMenuItem: CommandFactory = (
      node: MenuNode,
      index?: number,
      parentId?: string,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        const meta: MenuMeta = {
          add: {
            node,
            index,
            parentId,
          },
        };
        tr.setMeta(MenuPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const findMenuItem: CommandFactory = (id: string) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        const meta: MenuMeta = {
          find: {
            id,
          },
        };
        tr.setMeta(MenuPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const removeMenuItem: CommandFactory = (id: string) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        const meta: MenuMeta = {
          remove: {
            id,
          },
        };
        tr.setMeta(MenuPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const focusMenu: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        const meta: MenuMeta = {
          focus: true,
        };
        tr.setMeta(MenuPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const showCollapsedMenu: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        const meta: MenuMeta = {
          showCollapsedMenu: true,
        };
        tr.setMeta(MenuPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      focusMenu,
      addMenuItem,
      findMenuItem,
      removeMenuItem,
      showCollapsedMenu,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    if (!this.editor.config.element) {
      return [];
    }
    return [
      createMenuPlugin(this.editor, createDefaultMenuBar(this.editor)),
    ];
  }
}
