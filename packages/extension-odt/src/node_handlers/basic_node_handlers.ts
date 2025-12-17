import { iterateChildren, NodeHandler, OdtStashContext } from '../OdtParser.ts';

export function getInlineNodesHandlers(): Record<string, NodeHandler> {
  return {
    '$text': (ctx: OdtStashContext, value: any) => {
      const node = ctx.createText(value);
      if (node) {
        ctx.current.content.push(node);
      }
    },
    's': (ctx: OdtStashContext, odtElement: any) => {
      const chars = odtElement['@c'] || 1;
      const text = ' '.repeat(chars);
      const node = ctx.createText(text);
      if (node) {
        ctx.current.content.push(node);
      }
    },
    'tab': (ctx: OdtStashContext, odtElement: any) => {
      const node = ctx.createText('\t');
      if (node) {
        ctx.current.content.push(node);
      }
    },
    'rect': (ctx: OdtStashContext, odtElement: any) => {
      // if (odtElement['@rel-width'] === '100%') {
      //   ctx.openNode();
      //   ctx.closeNode('hr');
      // }
    },
    'line-break': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      ctx.closeNode('br');
    },
    'soft-page-break': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      ctx.closeNode('br');
    },

    'bookmark': (ctx: OdtStashContext, element: any) => { // bookmark for parent para
      ctx.openNode();
      ctx.closeNode('bookmark-node', {
        id: element['@name'],
      });
    },
    'bookmark-start': (ctx: OdtStashContext, element: any) => {
      // state.textMarks.add({
      //   markName: 'bookmark',
      //   markAttributes: {
      //     id: element['@name'],
      //   },
      // });
    },
    'bookmark-end': (ctx: OdtStashContext, element: any) => {
      // state.textMarks.forEach((x) =>
      //   x.markName === 'bookmark' &&
      //     x.markAttributes.id === element['@name']
      //     ? state.textMarks.delete(x)
      //     : x
      // );
    },
  };
}

export function getBasicNodesHandlers(): Record<string, NodeHandler> {
  return {
    'body': (ctx: OdtStashContext, value: any) => {
      ctx.handle('text', value.text);
    },
    'text': (ctx: OdtStashContext, value: any) => {
      iterateChildren(
        value.$value,
        (child) => ctx.handle(child.tag, child.value),
      );
    },
    'p': (ctx: OdtStashContext, value: any) => {
      const attrs = {};

      const style = ctx.getElementStyle(value);
      const heading = style.styles.find((item) =>
        item.startsWith('Heading_20_')
      );
      if (heading) {
        attrs.level = parseInt(heading.substring('Heading_20_'.length));
      }

      let nodeType = 'paragraph';
      if (style.styles.find((item) => item.startsWith('Heading_20_'))) {
        nodeType = 'heading';
      }

      ctx.openNode();
      const marks = ctx.styleToMarks(style);
      if (marks.length > 0) {
        ctx.current.marks = [...ctx.current.marks, ...marks];
      }

      iterateChildren(value.$value, (child) => {
        ctx.handle(child.tag, child.value);
      });

      ctx.closeNode(nodeType, attrs);
    },

    'table-of-content': (ctx: OdtStashContext, value: any) => {
      ctx.openNode();
      for (const pElem of value['index-body']['p']) {
        ctx.openNode();
        ctx.handle('p', pElem);
        ctx.closeNode('list_item');
      }
      ctx.closeNode('bullet_list');
    },

    'span': (ctx: OdtStashContext, value: any) => {
      const style = ctx.getElementStyle(value);

      const marks = ctx.styleToMarks(style);
      if (marks.length > 0) {
        ctx.stash();
        ctx.current.marks = [...ctx.current.marks, ...marks];
      }

      iterateChildren(value.$value, (child) => {
        ctx.handle(child.tag, child.value);
      });

      if (marks.length > 0) {
        ctx.unstash();
      }
    },
    'a': (ctx: OdtStashContext, value: any) => {
      const attrs = {
        href: value['@href'],
        // title: tok.attrGet('title') || null,
      };

      const markType = ctx.schema.mark('link', attrs);

      const marks = [markType];
      if (marks.length > 0) {
        ctx.stash();
        ctx.current.marks = [...ctx.current.marks, ...marks];
      }

      iterateChildren(value.$value, (child) => {
        ctx.handle(child.tag, child.value);
      });

      if (marks.length > 0) {
        ctx.unstash();
      }
    },
  };
}
