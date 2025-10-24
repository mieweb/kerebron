import { Extension } from '@kerebron/editor';
import { type CommandShortcuts } from '@kerebron/editor/commands';

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
const pcBaseKeymap: { [key: string]: string } = {
  'Mod-Enter': 'exitCode',
  'Backspace': 'backspace',
  'Mod-Backspace': 'backspace',
  'Shift-Backspace': 'backspace',
  'Delete': 'del',
  'Mod-Delete': 'del',
  'Mod-a': 'selectAll',
};

/// A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
/// **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
/// **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
/// Ctrl-Delete.
const macBaseKeymap: { [key: string]: string } = {
  ...pcBaseKeymap,
  'Ctrl-h': pcBaseKeymap['Backspace'],
  'Alt-Backspace': pcBaseKeymap['Mod-Backspace'],
  'Ctrl-d': pcBaseKeymap['Delete'],
  'Ctrl-Alt-Backspace': pcBaseKeymap['Mod-Delete'],
  'Alt-Delete': pcBaseKeymap['Mod-Delete'],
  'Alt-d': pcBaseKeymap['Mod-Delete'],
  'Ctrl-a': 'selectTextblockStart',
  'Ctrl-e': 'selectTextblockEnd',
};

const mac = /(Mac|iPhone|iPod|iPad)/i.test(navigator?.platform);

const baseKeymap: { [key: string]: string } = mac
  ? macBaseKeymap
  : pcBaseKeymap;

export class ExtensionBaseKeymap extends Extension {
  name = 'base-keymap';

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const shortcuts: CommandShortcuts = {
      'Enter': 'enter',
      'Alt-ArrowUp': 'joinUp',
      'Alt-ArrowDown': 'joinDown',
      'Mod-BracketLeft': 'lift',
      'Escape': 'selectParentNode',
    };

    for (const key in baseKeymap) {
      shortcuts[key] = baseKeymap[key];
    }

    return shortcuts;
  }
}
