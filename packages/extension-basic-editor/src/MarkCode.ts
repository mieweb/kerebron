import type { MarkSpec, MarkType } from 'prosemirror-model';
import { type CoreEditor, Mark } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class MarkCode extends Mark {
  override name = 'code';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleCode': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-`': 'toggleCode',
    };
  }
}
