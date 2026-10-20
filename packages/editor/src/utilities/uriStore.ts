import type { Node as PMNode } from 'prosemirror-model';

export function getRuntimeUri(node: PMNode): string | undefined {
  const lang: string = node.attrs.lang || 'txt';
  const id = node.attrs.id;

  if (!id) {
    return undefined;
  }

  let ext = 'txt';
  switch (lang) {
    case 'markdown':
      ext = 'md';
      break;
    case 'mermaid':
      ext = 'mmd';
      break;
    case 'javascript':
      ext = 'js';
      break;
    case 'typescript':
      ext = 'ts';
      break;
  }

  return 'file:///' + id + '.' + ext;
}
