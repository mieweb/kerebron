import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';

import { type MenuElement } from './menu.ts';
import { MenuPlugin } from './MenuPlugin.ts';
import { buildMenu } from './buildMenu.ts';

export interface MenuConfig {
  modifyMenu?(menus: MenuElement[][]): MenuElement[][];
  floating: boolean;
}

export class ExtensionMenuLegacy extends Extension {
  name = 'menu';

  constructor(protected override config: MenuConfig = { floating: true }) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    if (!this.editor.config.element) {
      return [];
    }
    const plugins: Plugin[] = [];

    let content = buildMenu(this.editor, this.editor.schema);
    if (this.config.modifyMenu) {
      content = this.config.modifyMenu(content);
    }
    plugins.push(
      new MenuPlugin({
        content,
        floating: this.config.floating,
      }),
    );

    return plugins;
  }
}
