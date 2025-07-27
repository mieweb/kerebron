import { Mark as PmMark, MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

export class MarkLink extends Mark {
  override name = 'link';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom: HTMLElement) {
            return {
              href: dom.getAttribute('href'),
              title: dom.getAttribute('title'),
            };
          },
        },
      ],
      toDOM(node) {
        const { href, title } = node.attrs;
        return ['a', { href, title }, 0];
      },
    };
  }
}
