import { type MarkSpec } from 'prosemirror-model';
import { Mark } from '@kerebron/editor';

/** Mark for text highlight (background color) */
export class MarkHighlight extends Mark {
  override name = 'highlight';

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        color: { default: null },
      },
      parseDOM: [
        {
          tag: 'mark',
          getAttrs(dom: HTMLElement) {
            const color = dom.style.backgroundColor;
            return color ? { color } : { color: 'yellow' };
          },
        },
        {
          tag: 'span[style*="background-color"]',
          getAttrs(dom: HTMLElement) {
            const color = dom.style.backgroundColor;
            return color ? { color } : false;
          },
        },
      ],
      toDOM(mark) {
        const { color } = mark.attrs;
        const bgColor = color || 'yellow';
        return ['mark', { style: `background-color: ${bgColor}` }, 0];
      },
    };
  }
}
