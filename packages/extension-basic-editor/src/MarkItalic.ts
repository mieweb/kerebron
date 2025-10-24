import { type CoreEditor, Mark } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import type { MarkSpec, MarkType } from 'prosemirror-model';

export class MarkItalic extends Mark {
  override name = 'em';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
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

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleItalic': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-i': 'toggleItalic',
      'Mod-I': 'toggleItalic',
    };
  }
}
