import { Mark as PmMark, MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

export class MarkLink extends Mark {
  override name = 'link';
  requires = ['doc'];

  automerge = {
    markName: 'link',
    parsers: {
      fromAutomerge: (mark: string /*: am.MarkValue*/) => {
        if (typeof mark === 'string') {
          try {
            const value = JSON.parse(mark);
            return {
              href: value.href || '',
              title: value.title || '',
            };
          } catch (e) {
            console.warn('failed to parse link mark as JSON');
          }
        }
        return {
          href: '',
          title: '',
        };
      },
      fromProsemirror: (mark: PmMark) =>
        JSON.stringify({
          href: mark.attrs.href,
          title: mark.attrs.title,
        }),
    },
  };

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
