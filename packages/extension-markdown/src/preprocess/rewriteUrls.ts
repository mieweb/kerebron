import { Mark, Node } from 'prosemirror-model';

import { AsyncCommandFactory } from '@kerebron/editor/commands';
import { UrlRewriter } from '@kerebron/editor';

export const rewriteUrls: AsyncCommandFactory =
  (urlRewriter?: UrlRewriter) => async (state, dispatch): Promise<boolean> => {
    if (!urlRewriter) {
      return false;
    }
    const tr = state.tr;

    const linkType = state.schema.marks.link;
    const imageType = state.schema.nodes.image;

    const linkMarks: Array<[Mark, number, number]> = [];
    const imageNodes: Array<[Node, number]> = [];

    state.doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type === linkType) {
          linkMarks.push([mark, pos, pos + node.nodeSize]);
        }
      });
      if (node.type === imageType) {
        imageNodes.push([node, pos]);
      }
    });

    for (const [mark, start, end] of linkMarks) {
      const origUrl = mark.attrs.href;
      const meta: Record<string, string> = {};
      const src = await urlRewriter(origUrl, {
        type: 'A',
        dest: 'md',
        setMeta: (key, value) => {
          meta[key] = value;
        },
      });
      if (src !== origUrl || meta['mdTemplate']) {
        const mdTemplate = meta['mdTemplate'];
        tr.removeMark(tr.mapping.map(start), tr.mapping.map(end), mark);
        const newMark = state.schema.mark('link', {
          ...mark.attrs,
          href: src,
          origUrl,
          mdTemplate,
        });
        tr.addMark(tr.mapping.map(start), tr.mapping.map(end), newMark);
      }
    }

    for (const [node, pos] of imageNodes) {
      const origUrl = node.attrs.src;
      const meta: Record<string, string> = {};
      const src = await urlRewriter(origUrl, {
        type: 'IMG',
        dest: 'md',
        setMeta: (key, value) => {
          meta[key] = value;
        },
      });
      if (src !== origUrl || meta['mdTemplate']) {
        const mdTemplate = meta['mdTemplate'];
        tr.setNodeMarkup(tr.mapping.map(pos), null, {
          ...node.attrs,
          src,
          origUrl,
          mdTemplate,
        });
      }
    }

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };
