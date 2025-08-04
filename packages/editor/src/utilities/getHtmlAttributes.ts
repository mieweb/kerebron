import type {
  MarkSpec,
  Node as ProseMirrorNode,
  NodeSpec,
} from 'prosemirror-model';

import type { Mark } from '../Mark.ts';
import type { Node } from '../Node.ts';

type MarkOfNode = Mark | Node;

export function getHtmlAttributes(
  extension: MarkOfNode,
  node: ProseMirrorNode,
) {
  const attrs: Record<string, any> = {};

  if (extension.attributes) {
    for (const [key, value] of Object.entries(extension.attributes)) {
      if ('undefined' !== typeof node.attrs[key]) {
        attrs[key] = node.attrs[key];
      } else {
        if (value.toDom) {
          attrs[key] = value.toDom(node);
        } else {
          attrs[key] = value.default;
        }
      }
    }
  }

  return attrs;
}

export function setHtmlAttributes(extension: MarkOfNode, element: HTMLElement) {
  const attrs: Record<string, any> = {};

  if (extension.attributes) {
    for (const [key, value] of Object.entries(extension.attributes)) {
      if (value.fromDom) {
        attrs[key] = value.fromDom(element);
      } else {
        attrs[key] = value.default;
      }
    }
  }

  return attrs;
}

export function addAttributesToSchema(
  spec: MarkSpec | NodeSpec,
  extension: MarkOfNode,
) {
  const attrs = {};

  if (extension.attributes) {
    if (!spec.attrs) {
      spec.attrs = {};
    }
    for (const [key, value] of Object.entries(extension.attributes)) {
      spec.attrs[key] = value;
      if (!value.toDom) {
        value.toDom = (node) => node.attrs[key];
      }
    }
  }
}
