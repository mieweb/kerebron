import { ListNumbering } from '../lists.ts';
import {
  iterateChildren,
  NodeHandler,
  OdtStashContext,
  resolveStyle,
} from '../OdtParser.ts';

export function getListNodesHandlers(): Record<string, NodeHandler> {
  return {
    'list': (ctx: OdtStashContext, odtElement: any) => {
      const listTracker = ctx.listTracker;
      const list = {
        level: listTracker.listStack.length + 1,
        odtElement,
      };
      listTracker.listStack.push(list);

      let style = {};
      let listId = null;
      for (let i = listTracker.listStack.length - 1; i >= 0; i--) {
        const element = listTracker.listStack[i].odtElement;
        if (!listId) {
          if (element['@id']) {
            listId = element['@id'];
          }
        }
        if (!style['@style-name']) {
          style = ('object' === typeof element && element['@style-name'])
            ? resolveStyle(
              ctx.stylesTree,
              ctx.automaticStyles,
              element['@style-name'],
            )
            : {};
        }
      }

      let nodeTypeName = 'bullet_list';
      const attrs = {};
      if (style) {
        const numLevelStyle = style['list-level-style-number'].find(
          (levelStyle) => parseInt(levelStyle['@level']) === list.level,
        );
        if (numLevelStyle) {
          attrs['type'] = numLevelStyle['@num-format'] || '1';
          nodeTypeName = 'ordered_list';
        }
      }

      ctx.current.meta['list_type'] = nodeTypeName;

      let listNumbering = null;

      if (listId && listTracker.listNumberings.has(listId)) {
        listNumbering = listTracker.listNumberings.get(listId);
      }

      let isContinue = false;
      if (
        odtElement['@continue-list'] &&
        listTracker.listNumberings.has(odtElement['@continue-list'])
      ) {
        listNumbering = listTracker.listNumberings.get(
          odtElement['@continue-list'],
        );
        isContinue = true;
      }
      if (odtElement['@continue-numbering']) {
        listNumbering = listTracker.lastNumbering;
        isContinue = true;
      }

      if (!listNumbering) {
        listNumbering = new ListNumbering();
      }

      if (isContinue) {
        listTracker.preserveMinLevel = 999;
      }

      if (listId) {
        listTracker.listNumberings.set(listId, listNumbering);
      }

      listTracker.lastNumbering = listNumbering;

      if (listTracker.preserveMinLevel <= list.level) {
        listNumbering.clearAbove(list.level - 1);
      }

      if (nodeTypeName === 'ordered_list') {
        attrs['start'] = listNumbering.levels[list.level] || 1;
      }

      ctx.openNode();

      const children = odtElement['list-item'].map((item) => ({
        'list-item': item,
      }));

      if (children) {
        iterateChildren(children, (child) => {
          ctx.handle(child.tag, child.value);
        });

        listNumbering.levels[list.level] += children.length;
      }

      ctx.closeNode(nodeTypeName, attrs);

      if (listTracker.preserveMinLevel >= list.level) {
        listTracker.preserveMinLevel = list.level;
      }

      listTracker.listStack.pop();
    },
    'list-item': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      iterateChildren(
        odtElement.$value,
        (child) => ctx.handle(child.tag, child.value),
      );

      const attrs = {};
      attrs.markup = '* ';

      ctx.closeNode('list_item', attrs);
    },
  };
}
