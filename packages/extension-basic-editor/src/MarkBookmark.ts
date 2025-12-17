import { MarkSpec } from 'prosemirror-model';

import { Mark } from '@kerebron/editor';

export class MarkBookmark extends Mark {
  override name = 'bookmark';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        id: {},
      },
      parseDOM: [],
      toDOM(mark) {
        return ['a', { id: mark.attrs.id }, 0];
      },
    };
  }
}
