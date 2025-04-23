import { dropCursor } from 'prosemirror-dropcursor';
import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';

export class ExtensionDropcursor extends Extension {
  name = 'dropcursor';

  options = {
    color: 'currentColor',
    width: 1,
    class: undefined,
  };

  getProseMirrorPlugins(): Plugin[] {
    return [
      dropCursor(this.options),
    ];
  }
}
