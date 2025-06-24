import { MarkSpec } from 'prosemirror-model';

import { Mark } from '@kerebron/editor';

export class MarkChange extends Mark {
  override name = 'change';
  requires = ['doc'];

  getMarkSpec(): MarkSpec {
    return {
      parseDOM: [
      ],
      toDOM() {
        return ['change', 0];
      },
    };
  }
}
