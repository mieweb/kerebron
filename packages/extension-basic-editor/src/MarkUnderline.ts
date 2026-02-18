import { CoreEditor, Mark } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import type { MarkSpec, MarkType } from 'prosemirror-model';

export class MarkUnderline extends Mark {
  override name = 'underline';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
        {
          tag: 'u',
        },
      ],
      toDOM() {
        return ['u', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleUnderline': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-u': 'toggleUnderline',
      'Mod-U': 'toggleUnderline',
    };
  }
}
