import { type MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

export class MarkYChange extends Mark {
  override name = 'ychange';

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        user: { default: null },
        type: { default: null },
      },
      inclusive: false,
      parseDOM: [{ tag: 'ychange' }],
      toDOM(node) {
        return ['ychange', {
          ychange_user: node.attrs.user,
          ychange_type: node.attrs.type,
        }];
      },
    };
  }
}
