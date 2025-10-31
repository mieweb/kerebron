import { type CoreEditor, Mark } from '@kerebron/editor';
import type { MarkSpec, MarkType } from 'prosemirror-model';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class MarkStrike extends Mark {
  override name = 'strike';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
        { tag: 'strike' },
      ],
      toDOM() {
        return ['strike', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleStrike': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-s': 'toggleStrike',
      'Mod-S': 'toggleStrike',
    };
  }
}
