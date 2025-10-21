import { type MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

/** Mark for text color (foreground color) */
export class MarkTextColor extends Mark {
  override name = 'textColor';

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        color: { default: null },
      },
      parseDOM: [
        {
          tag: 'span[style*="color"]',
          getAttrs(dom: HTMLElement) {
            const color = dom.style.color;
            return color ? { color } : false;
          },
        },
      ],
      toDOM(mark) {
        const { color } = mark.attrs;
        if (!color) return ['span', 0];
        return ['span', { style: `color: ${color}` }, 0];
      },
    };
  }
}
