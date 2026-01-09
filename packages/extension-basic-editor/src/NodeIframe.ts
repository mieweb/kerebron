import { type NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeIframe extends Node {
  override name = 'iframe';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      attrs: {
        src: {},
        class: { default: null },
        alt: { default: null },
        title: { default: null },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'iframe[src]',
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute('src'),
              title: dom.getAttribute('title'),
              alt: dom.getAttribute('alt'),
            };
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title } = node.attrs;
        return ['iframe', { src, alt, title, class: node.attrs.class }];
      },
    };
  }
}
