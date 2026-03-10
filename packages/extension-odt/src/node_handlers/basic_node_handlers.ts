import { NESTING_CLOSING, NESTING_OPENING } from '@kerebron/editor';
import { iterateChildren, NodeHandler, OdtStashContext } from '../OdtParser.ts';

export function inchesToMm(value: string): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith('pt')) {
    return parseFloat(value.substring(0, value.length - 2)) * 0.3528;
  }
  if (value.endsWith('in')) {
    return parseFloat(value.substring(0, value.length - 2)) * 25.4;
  }
  if (value.endsWith('em')) {
    return parseFloat(value.substring(0, value.length - 2)) / 0.125 * 25.4;
  }
  return 0;
}

export function getInlineNodesHandlers(): Record<string, NodeHandler> {
  return {
    '$text': (ctx: OdtStashContext, value: any) => {
      if (ctx.current.marks.length > 0) {
        const parts = value.match(/^([ \t\u00A0]*)(.*)([ \t\u00A0]*)$/);

        if (parts[1]) {
          ctx.current.content.push(ctx.schema.text(parts[1]));
        }
        const node = ctx.createText(parts[2]);
        if (node) {
          ctx.current.content.push(node);
        }
        if (parts[3]) {
          ctx.current.content.push(ctx.schema.text(parts[3]));
        }
        return;
      }

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
      if (odtElement['@rel-width'] === '100%') {
        ctx.openNode();
        ctx.closeNode('hr');
      }
    },
    'line-break': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      ctx.closeNode('br');
    },
    'soft-page-break': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      ctx.closeNode('softbreak');
    },
    'bookmark': (ctx: OdtStashContext, element: any) => { // bookmark for parent para
      ctx.openNode();
      ctx.closeNode('node_bookmark', {
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
    'change-start': (ctx: OdtStashContext, element: any) => {
      ctx.openNode();
      ctx.closeNode('comment', {
        id: element['@change-id'],
        nesting: NESTING_OPENING,
      });
    },
    'change-end': (ctx: OdtStashContext, element: any) => {
      ctx.openNode();
      ctx.closeNode('comment', {
        id: element['@change-id'],
        nesting: NESTING_CLOSING,
      });
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
      const attrs: Record<string, any> = {};

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
      const levels: number[] = [];

      let prevMarginLeft = -1;
      for (const pElem of value['index-body']['p']) {
        const style = ctx.getElementStyle(pElem) as any;
        let marginLeft = 0;
        if ('paragraph-properties' in style) {
          marginLeft = inchesToMm(
            style['paragraph-properties']['@margin-left'],
          );
        }

        if (prevMarginLeft < marginLeft) {
          if (levels.length > 0) {
            ctx.openNode(); // list_item
          }
          ctx.openNode(); // bullet_list
          levels.push(marginLeft);
        } else {
          for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i] > marginLeft) {
              ctx.closeNode('bullet_list', { odtMarginLeft: marginLeft });
              if (i > 0) {
                ctx.closeNode('list_item');
              }
              levels.pop();
            } else {
              break;
            }
          }
        }
        ctx.openNode();
        ctx.handle('p', pElem);
        ctx.closeNode('list_item');

        prevMarginLeft = marginLeft;
      }

      for (let i = levels.length - 1; i >= 0; i--) {
        const marginLeft = levels.pop();
        if (i > 0) {
          ctx.closeNode('bullet_list', { odtMarginLeft: marginLeft });
          ctx.closeNode('list_item');
        } else {
          ctx.closeNode('bullet_list', {
            odtMarginLeft: marginLeft,
            toc: true,
          });
        }
      }
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
