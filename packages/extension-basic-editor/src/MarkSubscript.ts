import { type CoreEditor, Mark } from '@kerebron/editor';
import type { MarkSpec, MarkType } from 'prosemirror-model';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class MarkSubscript extends Mark {
  override name = 'subscript';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      excludes: 'superscript',
      parseDOM: [
        { tag: 'sub' },
        {
          style: 'vertical-align',
          getAttrs: (value) => value === 'sub' && null,
        },
      ],
      toDOM() {
        return ['sub', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {
      'toggleSubscript': () => editor.commandFactories.toggleMark(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-Shift-,': 'toggleSubscript',
    };
  }
}
