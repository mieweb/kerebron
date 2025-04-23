import { type Node as PmNode, type NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';
import { next as automerge } from '@automerge/automerge/slim';

import { BlockMarker } from '@kerebron/extension-automerge';

export class NodeImage extends Node {
  override name = 'image';
  requires = ['doc'];

  automerge = {
    block: 'image',
    isEmbed: true,
    attrParsers: {
      fromAutomerge: (block: BlockMarker) => ({
        src: block.attrs.src?.toString() || null,
        alt: block.attrs.alt,
        title: block.attrs.title,
      }),
      fromProsemirror: (node: PmNode) => ({
        src: new automerge.RawString(node.attrs.src),
        alt: node.attrs.alt,
        title: node.attrs.title,
      }),
    },
  };

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'img[src]',
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
        return ['img', { src, alt, title }];
      },
    };
  }
}
