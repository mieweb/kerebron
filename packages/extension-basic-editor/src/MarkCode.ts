import { MarkSpec, MarkType } from 'prosemirror-model';
import { CoreEditor, Mark } from '@kerebron/editor';
import {
  Commands,
  CommandShortcuts,
  toggleMark,
} from '@kerebron/editor/commands';

export class MarkCode extends Mark {
  override name = 'code';
  requires = ['doc'];

  getMarkSpec(): MarkSpec {
    return {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code', 0];
      },
    };
  }

  getCommands(editor: CoreEditor, type: MarkType): Partial<Commands> {
    return {
      'toggleCode': () => toggleMark(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-`': 'toggleCode',
    };
  }
}
