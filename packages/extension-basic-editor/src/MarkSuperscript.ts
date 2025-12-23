import { type CoreEditor, Mark } from '@kerebron/editor';
import type { MarkSpec, MarkType } from 'prosemirror-model';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class MarkSuperscript extends Mark {
  override name = 'superscript';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      excludes: 'subscript',
      parseDOM: [
        { tag: 'sup' },
        {
          style: 'vertical-align',
          getAttrs: (value) => value === 'super' && null,
        },
      ],
      toDOM() {
        return ['sup', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleSuperscript': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-Shift-.': 'toggleSuperscript',
    };
  }
}
