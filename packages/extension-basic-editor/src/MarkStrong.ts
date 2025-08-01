import { CoreEditor, Mark } from '@kerebron/editor';
import {
  Commands,
  CommandShortcuts,
  toggleMark,
} from '@kerebron/editor/commands';
import { MarkType } from 'prosemirror-model';

export class MarkStrong extends Mark {
  override name = 'strong';
  requires = ['doc'];

  getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
        { tag: 'strong' },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: 'b',
          getAttrs: (node: HTMLElement) =>
            node.style.fontWeight != 'normal' && null,
        },
        { style: 'font-weight=400', clearMark: (m) => m.type.name == 'strong' },
        {
          style: 'font-weight',
          getAttrs: (value: string) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM() {
        return ['strong', 0];
      },
    };
  }

  getCommands(editor: CoreEditor, type: MarkType): Partial<Commands> {
    return {
      'toggleStrong': () => toggleMark(type),
    };
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-b': 'toggleStrong',
      'Mod-B': 'toggleStrong',
    };
  }
}
