import { MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

export class MarkUnknown extends Mark {
  override name = 'unknownMark';
  requires = ['doc'];

  getMarkSpec(): MarkSpec {
    return {
      attrs: { unknownMarks: { default: null } },
      toDOM() {
        return ['span', { 'data-unknown-mark': true }];
      },
    };
  }
}
