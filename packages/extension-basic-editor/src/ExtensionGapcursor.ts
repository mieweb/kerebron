import { gapCursor } from 'prosemirror-gapcursor';
import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';

export class ExtensionGapcursor extends Extension {
  name = 'gapcursor';

  options = {
    color: 'currentColor',
    width: 1,
    class: undefined,
  };

  override getProseMirrorPlugins(): Plugin[] {
    return [
      gapCursor(),
    ];
  }
}
