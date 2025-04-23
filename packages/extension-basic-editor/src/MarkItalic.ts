import { CoreEditor, Mark } from '@kerebron/editor';
import {
  Commands,
  CommandShortcuts,
  toggleMark,
} from '@kerebron/editor/commands';

export class MarkItalic extends Mark {
  override name = 'em';
  requires = ['doc'];

  automerge = {
    markName: 'em',
  };

  getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-assets=italic' },
        { style: 'font-assets=normal', clearMark: (m) => m.type.name == 'em' },
      ],
      toDOM() {
        return ['em', 0];
      },
    };
  }

  getCommands(editor: CoreEditor, type: MarkType): Partial<Commands> {
    return {
      'toggleItalic': () => toggleMark(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-i': 'toggleItalic',
      'Mod-I': 'toggleItalic',
    };
  }
}
