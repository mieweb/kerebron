import { Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { type MenuElement } from './menu.ts';
import { buildMenu } from './ExtensionMenu.ts';
import { CustomMenuPlugin } from './CustomMenuPlugin.ts';

export interface CustomMenuOptions {
  /// Provides the content of the menu
  content: readonly (readonly MenuElement[])[];
}

/// Extension for a customizable menu with pinned items
export class ExtensionCustomMenu extends Extension {
  name = 'customMenu';

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const content = buildMenu(editor, schema);

    return [
      new CustomMenuPlugin(editor, {
        content,
      }),
    ];
  }
}
