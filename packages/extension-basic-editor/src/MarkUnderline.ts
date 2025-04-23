import { CoreEditor, Mark } from '@kerebron/editor';
import {
  Commands,
  CommandShortcuts,
  toggleMark,
} from '@kerebron/editor/commands';

export class MarkUnderline extends Mark {
  override name = 'underline';
  requires = ['doc'];

  automerge = {
    markName: 'u',
  };

  getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
        {
          tag: 'u',
        },
        {
          style: 'text-decoration',
          consuming: false,
          getAttrs: (
            style,
          ) => ((style as string).includes('underline') ? {} : false),
        },
      ],
      toDOM() {
        return ['u', 0];
      },
    };
  }

  getCommands(editor: CoreEditor, type: MarkType): Partial<Commands> {
    return {
      'toggleUnderline': () => toggleMark(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-u': 'toggleUnderline',
      'Mod-U': 'toggleUnderline',
    };
  }
}
