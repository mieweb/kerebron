import { Extension } from '@kerebron/editor';
import {
  chainCommands,
  Command,
  createParagraphNear,
  deleteSelection,
  exitCode,
  joinBackward,
  joinDown,
  joinForward,
  joinUp,
  lift,
  liftEmptyBlock,
  newlineInCode,
  selectAll,
  selectNodeBackward,
  selectNodeForward,
  selectParentNode,
  selectTextblockEnd,
  selectTextblockStart,
  splitBlock,
} from '@kerebron/editor/commands';
import {
  type Commands,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { CommandFactories } from '../../editor/src/Node.ts';

const backspace = chainCommands(
  deleteSelection,
  joinBackward,
  selectNodeBackward,
);
const del = chainCommands(deleteSelection, joinForward, selectNodeForward);

/// A basic keymap containing bindings not specific to any schema.
/// Binds the following keys (when multiple commands are listed, they
/// are chained with [`chainCommands`](#commands.chainCommands)):
///
/// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
/// * **Mod-Enter** to `exitCode`
/// * **Backspace** and **Mod-Backspace** to `deleteSelection`, `joinBackward`, `selectNodeBackward`
/// * **Delete** and **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-a** to `selectAll`
const pcBaseKeymap: { [key: string]: Command } = {
  'Enter': chainCommands(
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitBlock,
  ),
  'Mod-Enter': exitCode,
  'Backspace': backspace,
  'Mod-Backspace': backspace,
  'Shift-Backspace': backspace,
  'Delete': del,
  'Mod-Delete': del,
  'Mod-a': selectAll,
};

/// A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
/// **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
/// **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
/// Ctrl-Delete.
const macBaseKeymap: { [key: string]: Command } = {
  'Ctrl-h': pcBaseKeymap['Backspace'],
  'Alt-Backspace': pcBaseKeymap['Mod-Backspace'],
  'Ctrl-d': pcBaseKeymap['Delete'],
  'Ctrl-Alt-Backspace': pcBaseKeymap['Mod-Delete'],
  'Alt-Delete': pcBaseKeymap['Mod-Delete'],
  'Alt-d': pcBaseKeymap['Mod-Delete'],
  'Ctrl-a': selectTextblockStart,
  'Ctrl-e': selectTextblockEnd,
};
for (let key in pcBaseKeymap) (macBaseKeymap as any)[key] = pcBaseKeymap[key];

const mac = /(Mac|iPhone|iPod|iPad)/i.test(navigator?.platform);

/// Depending on the detected platform, this will hold
/// [`pcBasekeymap`](#commands.pcBaseKeymap) or
/// [`macBaseKeymap`](#commands.macBaseKeymap).
export const baseKeymap: { [key: string]: Command } = mac
  ? macBaseKeymap
  : pcBaseKeymap;

export class ExtensionBaseKeymap extends Extension {
  name = 'base-keymap';

  override getCommandFactories(): Partial<CommandFactories> {
    const commands: CommandFactories = {
      joinUp: () => (state, dispatch) => joinUp(state, dispatch),
      joinDown: () => (state, dispatch) => joinDown(state, dispatch),
      lift: () => (state, dispatch) => lift(state, dispatch),
      selectParentNode: () => (state, dispatch) =>
        selectParentNode(state, dispatch),
      selectNodeBackward: () => (state, dispatch) =>
        selectNodeBackward(state, dispatch),
      selectNodeForward: () => (state, dispatch) =>
        selectNodeForward(state, dispatch),
    };

    for (const key in baseKeymap) {
      commands[this.name + '_' + key] = () => baseKeymap[key];
    }

    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const shortcuts: CommandShortcuts = {
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
