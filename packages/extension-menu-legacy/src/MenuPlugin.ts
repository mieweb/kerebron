import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';

import { type CoreEditor } from '@kerebron/editor';
import { type OverLayer } from '@kerebron/ui/OverLayer';
import { findFocusableChild } from '@kerebron/ui/popup/utils';
import { KerebronPopup } from '@kerebron/ui/popup';

import { renderDropdown, renderItems, renderMenu } from './renderMenu.ts';
import { MenuBar, MenuDropdown, MenuNode } from './model.ts';
import { Ui } from '@kerebron/ui';
import { DOMOutputSpec } from 'prosemirror-model';

export interface MenuMeta {
  add?: { parentId: string | undefined; node: MenuNode; index?: number };
  remove?: { id: string };
  find?: { id: string };
  focus?: true;
  showCollapsedMenu?: true;
}

class MenuState {
  private trayPopup?: KerebronPopup;
  private collapsedMenuItems: string[] = [];

  constructor(
    private readonly editor: CoreEditor,
    public readonly menu: MenuBar,
  ) {
  }

  add(
    { parentId, node, index }: {
      parentId: string | undefined;
      node: MenuNode;
      index?: number;
    },
  ): void {
    const target = parentId
      ? this.findDropdown(parentId)?.items
      : this.menu.items;

    if (!target) {
      throw new Error(`Menu parent not found: ${parentId}`);
    }

    if (index === undefined) {
      target.push(node);
    } else {
      target.splice(index, 0, node);
    }
  }

  remove(id: string): MenuNode | undefined {
    const result = this.removeFrom(this.menu.items, id);
    return result;
  }

  find(id: string): MenuNode | undefined {
    return this.findIn(this.menu.items, id);
  }

  private findDropdown(id: string): MenuDropdown | undefined {
    const node = this.find(id);
    return node?.type === 'dropdown' ? node : undefined;
  }

  private findIn(nodes: MenuNode[], id: string): MenuNode | undefined {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      if (node.type === 'dropdown') {
        const found = this.findIn(node.items, id);
        if (found) return found;
      }
    }

    return undefined;
  }

  private removeFrom(nodes: MenuNode[], id: string): MenuNode | undefined {
    const index = nodes.findIndex((node) => node.id === id);

    if (index !== -1) {
      return nodes.splice(index, 1)[0];
    }

    for (const node of nodes) {
      if (node.type === 'dropdown') {
        const removed = this.removeFrom(node.items, id);
        if (removed) return removed;
      }
    }

    return undefined;
  }

  handleCommands(pluginMeta: MenuMeta | undefined, transaction: Transaction) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta.add) {
      this.add(pluginMeta.add);
    }
    if (pluginMeta.remove) {
      this.remove(pluginMeta.remove.id);
    }
    if (pluginMeta.find) {
      this.find(pluginMeta.find.id);
    }
    if (pluginMeta.focus) {
      this.focus();
    }
    if (pluginMeta.showCollapsedMenu) {
      this.showCollapsedMenu();
    }

    return false;
  }

  focus() {
    const menuElement: HTMLElement | undefined =
      this.editor.wrapperElement?.querySelector('.kb-menu') || undefined;

    const element = findFocusableChild(menuElement);
    element?.focus();
  }

  async showCollapsedMenu() {
    const ui: Ui = this.editor.ci.resolve('ui');

    this.trayPopup = ui.createPopup({
      anchorId: '--menuitem-more-tools',
      layer: 'toplayer',
      group: 'menu',
    });
    this.trayPopup.addEventListener('remove', () => {
      this.trayPopup = undefined;
    });

    await ui.setPopupContent(this.trayPopup, this.renderTray());
  }

  renderTray(): DOMOutputSpec {
    const trayItems = this.menu.items.filter((i) =>
      this.collapsedMenuItems.includes(i.id)
    );

    return [
      'ui',
      { class: 'kb-menu__collapsed' },
      ...renderItems(trayItems, this.editor),
    ];
  }

  async resizeMenu() {
    const menuBarElement = this.editor.wrapperElement?.querySelector(
      '.kb-menu__bar',
    );
    if (!menuBarElement) {
      return;
    }

    const items = [
      ...menuBarElement.querySelectorAll<HTMLElement>('.kb-menu__item'),
    ];

    let currentWidth = 0;
    const hidden = [];
    for (const item of items) {
      if (currentWidth > menuBarElement.clientWidth) {
        if (item.dataset.menuId) {
          hidden.push(item.dataset.menuId);
        }
      }
      currentWidth += item.offsetWidth;
    }

    this.collapsedMenuItems = hidden;

    if (this.trayPopup) {
      const ui: Ui = this.editor.ci.resolve('ui');
      await ui.setPopupContent(this.trayPopup, this.renderTray());
    }
  }
}

export const MenuPluginKey = new PluginKey<MenuState>('menu');

export function createMenuPlugin(editor: CoreEditor, menuBar: MenuBar) {
  return new Plugin<MenuState>({
    key: MenuPluginKey,
    props: {
      handleKeyDown: (view, event) => {
        console.log(
          'handleKeyDownhandleKeyDownhandleKeyDownhandleKeyDown',
          event.key,
          event.ctrlKey,
        );

        if (event.key === '/' && event.ctrlKey) {
          const m = MenuPluginKey.getState(editor.state);
          m?.focus();
          // console.log('MMM', event);
          return true;
        }
        return false;
      },
    },
    state: {
      init() {
        return new MenuState(editor, menuBar);
      },
      apply(transaction, nextPasteState: MenuState, prevState, state) {
        if (transaction.isGeneric) {
          return nextPasteState;
        }

        const oldClonedState: EditorState | undefined = transaction.getMeta(
          'cloned',
        );
        if (oldClonedState) {
          const oldClonedPluginState = MenuPluginKey.getState(
            oldClonedState,
          );
          if (oldClonedPluginState) {
            return oldClonedPluginState;
          }
        }

        const pluginMeta: MenuMeta | undefined = transaction.getMeta(
          MenuPluginKey,
        );

        if (nextPasteState.handleCommands(pluginMeta, transaction)) {
          return nextPasteState;
        }

        return nextPasteState;
      },
    },
    view(editorView) {
      const menuState: MenuState = this.key?.getState(editor.state);

      if (!editor.wrapperElement) {
        return {};
      }

      let menuElement: HTMLElement | undefined =
        editor.wrapperElement.querySelector('.kb-menu') || undefined;
      if (!menuElement) {
        menuElement = document.createElement('div');
        menuElement.classList.add('kb-menu');
        editor.wrapperElement.prepend(menuElement);

        editor.editorElement?.addEventListener('focus', () => {
          menuElement?.classList.add('sticky');
        });

        editor.editorElement?.addEventListener('blur', () => {
          menuElement?.classList.remove('sticky');
        });

        const clickListener = async (pointerEvent: PointerEvent) => {
          const target = pointerEvent.target as HTMLElement;
          const button = target.closest('[data-menu-id]') as
            | HTMLElement
            | undefined;
          if (button && button.dataset.menuId) {
            const findItem = (
              menuId: string,
              items: MenuNode[],
            ): MenuNode | undefined => {
              for (const item of items) {
                if (item.id === menuId) {
                  return item;
                }

                if (item.type === 'dropdown') {
                  const subItem = findItem(menuId, item.items);
                  if (subItem) {
                    return subItem;
                  }
                }
              }
            };

            const menuItem = findItem(button.dataset.menuId, menuBar.items) ||
              findItem(button.dataset.menuId, menuBar.tray);
            if (!menuItem) {
              return;
            }

            switch (menuItem.type) {
              case 'item':
                {
                  if (menuItem.action) {
                    menuItem.action(editor);
                  }
                }
                break;
              case 'dropdown':
                {
                  const spec = renderDropdown(
                    menuItem.items,
                    editor,
                    menuItem.id,
                  );
                  const anchorId = button.dataset.anchor;

                  const ui: Ui = editor.ci.resolve('ui');
                  const popup = ui.createPopup({
                    layer: 'toplayer',
                    anchorId,
                    group: 'menu',
                  });
                  ui.setPopupContent(popup, spec);
                  // TODO: chevrons update
                  ui.walkPopups((popup: KerebronPopup) => {
                    const menuId = popup.getAttribute('data-menu-id');
                    if (menuId === menuItem.id) {
                      // popup.addC
                      // popup.refresh();
                      // parent
                    }
                  });
                }
                break;
            }
          }
        };

        const toplayer: OverLayer = editor.ci.resolve('toplayer')!;
        const overlayer: OverLayer = editor.ci.resolve('overlayer')!;
        menuElement.addEventListener('click', clickListener);
        toplayer.overLayerContainer.addEventListener('click', clickListener);
        overlayer.overLayerContainer.addEventListener('click', clickListener);
      }

      const { update } = renderMenu(menuElement, menuBar, editor);

      const observer = new ResizeObserver(() => menuState.resizeMenu());
      observer.observe(menuElement);

      return {
        update: () => update(),
        destroy() {
          observer.disconnect();
        },
      };
    },
  });
}
