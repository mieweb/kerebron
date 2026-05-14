import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { type MenuElement } from './menu.ts';
import { buildMenu } from './buildMenu.ts';
import { CustomMenuPlugin } from './CustomMenuPlugin.ts';

export interface MenuConfig {
  modifyMenu?(menus: MenuElement[][]): MenuElement[][];
}

/// Extension for a customizable menu with pinned items
export class ExtensionCustomMenu extends Extension {
  name = 'customMenu';

  constructor(public override config: MenuConfig = {}) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    if (!this.editor.config.element) {
      return [];
    }
    let content = buildMenu(this.editor, this.editor.schema);
    if (this.config.modifyMenu) {
      content = this.config.modifyMenu(content);
    }

    return [
      new CustomMenuPlugin(this.editor, {
        content,
      }),
    ];
  }
}
