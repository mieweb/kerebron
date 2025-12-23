import { history, redo, undo } from 'prosemirror-history';
import { Plugin } from 'prosemirror-state';

import { type CoreEditor, Extension } from '@kerebron/editor';
import {
  type Command,
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class ExtensionHistory extends Extension {
  name = 'history';

  options = {
    depth: 100,
    newGroupDelay: 500,
  };

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    return {
      'undo': () => undo,
      'redo': () => redo,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    // https://stackoverflow.com/a/73619128
    const mac = typeof navigator != 'undefined'
      ? /Mac|iP(hone|[oa]d)/.test(navigator?.platform)
      : false;

    const shortcuts = {
      'Mod-z': 'undo',
      'Mod-y': 'redo',
    };
    if (!mac) {
      shortcuts['Mod-y'] = 'redo';
    }

    return shortcuts;
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      history(this.options),
    ];
  }
}
