import { type NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeVideo extends Node {
  override name = 'video';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      attrs: {
        src: {},
        title: { default: null },
        controls: { default: true },
        width: { default: null },
        height: { default: null },
      },
      group: 'block',
      draggable: true,
      parseDOM: [
        {
          tag: 'video[src]',
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute('src'),
              title: dom.getAttribute('title'),
              controls: dom.hasAttribute('controls'),
              width: dom.getAttribute('width'),
              height: dom.getAttribute('height'),
            };
          },
        },
      ],
      toDOM(node) {
        const { src, title, controls, width, height } = node.attrs;
        const attrs: any = { src };
        if (title) attrs.title = title;
        if (controls) attrs.controls = ''; // Boolean attribute - just needs to be present
        if (width) attrs.width = width;
        if (height) attrs.height = height;
        return ['video', attrs];
      },
    };
  }
}
