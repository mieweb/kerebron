import { Node } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { UrlRewriter } from '@kerebron/editor';

export async function urlRewrite(
  urlFromRewriter: UrlRewriter,
  filesMap: Record<string, Uint8Array>,
  state: EditorState,
  dispatch: (tr: Transaction) => void,
): Promise<boolean> {
  const imageNodes: Array<{ node: Node; pos: number }> = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image') {
      imageNodes.push({ node, pos });
    }
  });

  const linkNodes: Array<{ node: Node; pos: number }> = [];
  state.doc.descendants((node, pos) => {
    if (node.marks.find((mark) => mark.type.name === 'link')) {
      linkNodes.push({ node, pos });
    }
  });

  const tr = state.tr;

  for (const { node, pos } of linkNodes) {
    const linkMark = node.marks.find((mark) => mark.type.name === 'link');
    if (!linkMark) {
      continue;
    }
    let href = linkMark.attrs.href || '';
    href = await urlFromRewriter(href, {
      type: 'A',
      dest: 'kerebron',
    });
    if (href !== linkMark.attrs.href) {
      const newMarks = node.marks.map((mark) => {
        if (mark.type.name === 'link') {
          const markType = state.schema.marks['link'];
          return markType.create({ ...mark.attrs, href });
        }
        return mark;
      });

      const nodeType = state.schema.nodes[node.type.name];
      let replaceNode;
      if (nodeType.isText) {
        replaceNode = state.schema.text(
          node.text || '',
          newMarks,
        );
      } else {
        replaceNode = nodeType.create(
          node.attrs,
          node.content,
          newMarks,
        );
      }
      tr.replaceWith(
        tr.mapping.map(pos),
        tr.mapping.map(pos + node.nodeSize),
        replaceNode,
      );
    }
  }

  for (const { node, pos } of imageNodes) {
    let src = node.attrs.src || '';

    src = await urlFromRewriter(src, {
      type: 'IMG',
      dest: 'kerebron',
      filesMap,
    });

    if (src !== node.attrs.src) {
      const nodeType = state.schema.nodes[node.type.name];
      const replaceNode = nodeType.create(
        { ...node.attrs, src },
        node.content,
        node.marks,
      );
      tr.replaceWith(
        tr.mapping.map(pos),
        tr.mapping.map(pos + node.nodeSize),
        replaceNode,
      );
    }
  }
  dispatch(tr);

  return tr.docChanged;
}
