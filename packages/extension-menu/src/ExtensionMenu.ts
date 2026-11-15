import { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import { createMenuPlugin, MenuMeta, MenuPluginKey } from './MenuPlugin.ts';
import { createDefaultMenuBar } from './defaultMenuBar.ts';
import { MenuNode } from './model.ts';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /** Move focus to the menu bar. */
    focusMenu: () => ReturnType;
    /**
     * Add a menu item.
     *
     * @param node The menu item, separator, or dropdown to add.
     * @param index Position to insert at; appended if omitted.
     * @param parentId Parent dropdown id; top level if omitted.
     */
    addMenuItem: (
      node: MenuNode,
      index?: number,
      parentId?: string,
    ) => ReturnType;
    /**
     * Locate a menu item by id.
     *
     * @param id Id of the menu item to find.
     */
    findMenuItem: (id: string) => ReturnType;
    /**
     * Remove a menu item by id.
     *
     * @param id Id of the menu item to remove.
     */
    removeMenuItem: (id: string) => ReturnType;
    /** Show the collapsed-items overflow menu; succeeds only if collapsed items exist. */
    showCollapsedMenu: () => ReturnType;
  }
}

export class ExtensionMenu extends Extension {
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

        const pluginsState = MenuPluginKey.getState(state);
        if (!pluginsState) {
          return false;
        }
        return pluginsState.collapsedMenuItems.length > 0;
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
