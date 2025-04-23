import { Extension } from '@kerebron/editor';
import {
  baseKeymap,
  joinDown,
  joinUp,
  lift,
  selectParentNode,
} from '@kerebron/editor/commands';
import {
  type Commands,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class ExtensionBaseKeymap extends Extension {
  name = 'base-keymap';

  getCommands(): Partial<Commands> {
    const commands = {
      joinUp: () => (state, dispatch) => joinUp(state, dispatch),
      joinDown: () => (state, dispatch) => joinDown(state, dispatch),
      lift: () => (state, dispatch) => lift(state, dispatch),
      selectParentNode: () => (state, dispatch) =>
        selectParentNode(state, dispatch),
    };

    for (const key in baseKeymap) {
      commands[this.name + '_' + key] = () => baseKeymap[key];
    }

    return commands;
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const shortcuts = {
      'Alt-ArrowUp': 'joinUp',
      'Alt-ArrowDown': 'joinDown',
      'Mod-BracketLeft': 'lift',
      'Escape': 'selectParentNode',
    };

    for (const key in baseKeymap) {
      shortcuts[key] = this.name + '_' + key;
    }

    return shortcuts;
  }
}
