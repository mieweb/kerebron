import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { type MenuElement } from './menu.ts';
import { buildMenu } from './buildMenu.ts';
import { CustomMenuPlugin } from './CustomMenuPlugin.ts';

export interface CustomMenuOptions {
  /// Provides the content of the menu
  content: readonly (readonly MenuElement[])[];
}

/// Extension for a customizable menu with pinned items
export class ExtensionCustomMenu extends Extension {
  name = 'customMenu';

  override getProseMirrorPlugins(): Plugin[] {
    const content = buildMenu(this.editor, this.editor.schema);

    return [
      new CustomMenuPlugin(this.editor, {
        content,
      }),
    ];
  }
}
