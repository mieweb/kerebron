import {
  iterateChildren,
  NodeHandler,
  OdtStashContext,
  resolveStyle,
} from '../OdtParser.ts';

// https://docs.oasis-open.org/office/OpenDocument/v1.4/OpenDocument-v1.4-part3-schema.html#a_19_880_22__text_list_
// The text:style-name attribute specifies the name of a list style that is applied to a list.
// If this attribute is not included and therefore no list style is specified, one of the following actions is taken:
//     •If a list is contained within another list, the list style defaults to the style of the surrounding list.
//     •If there is no list style specified for the surrounding list, but the list's list items contain paragraphs that have paragraph styles attached specifying a list style, that list style is used.
//     •An implementation-dependent default list style is used.
// To determine which formatting properties are applied to a list, the list level and list style name are taken into account.
function processListStyle(ctx: OdtStashContext, level: number) {
  const listTracker = ctx.listTracker;
  const attrs: Record<string, string> = {};

  let style = {};
  for (let i = listTracker.listStack.length - 1; i >= 0; i--) {
    const list = listTracker.listStack[i];
    if (!style['@style-name']) {
      style = (list.styleName)
        ? resolveStyle(
          ctx.stylesTree,
          ctx.automaticStyles,
          list.styleName,
        )
        : {};
    }
  }

  let nodeTypeName = 'bullet_list';
  if (style) {
    const numLevelStyle = style['list-level-style-number'].find(
      (levelStyle) => parseInt(levelStyle['@level']) === level,
    );
    if (numLevelStyle) {
      attrs['type'] = numLevelStyle['@num-format'] || '1';
      if (numLevelStyle['@start-value']) {
        attrs['start'] = numLevelStyle['@start-value'];
      }
      nodeTypeName = 'ordered_list';
    }
  }

  return {
    attrs,
    nodeTypeName,
  };
}

// https://docs.oasis-open.org/office/OpenDocument/v1.4/OpenDocument-v1.4-part3-schema.html#element-text_list
export function getListNodesHandlers(): Record<string, NodeHandler> {
  return {
    'list': (ctx: OdtStashContext, odtElement: any) => {
      const listTracker = ctx.listTracker;
      listTracker.pushList(odtElement['@id'], odtElement['@style-name']);

      const { nodeTypeName, attrs } = processListStyle(
        ctx,
        listTracker.getCurrentList().level,
      );

      ctx.current.meta['list_type'] = nodeTypeName;

      if (odtElement['@id']) {
        attrs['id'] = odtElement['@id'];
      }
      if (odtElement['@continue-list']) {
        attrs['continue'] = odtElement['@continue-list'];
      }
      if (odtElement['@continue-numbering']) {
        attrs['continue'] = '_last';
      }

      ctx.openNode();

      const children = odtElement['list-item'].map((item) => ({
        'list-item': item,
      }));

      iterateChildren(children, (child) => {
        ctx.handle(child.tag, child.value);
      });

      if (ctx.current.content.length === 0) {
        ctx.dropNode();
      } else {
        ctx.closeNode(nodeTypeName, attrs);
      }

      listTracker.listStack.pop();
    },
    'list-item': (ctx: OdtStashContext, odtElement: any) => {
      ctx.openNode();
      iterateChildren(
        odtElement.$value,
        (child) => ctx.handle(child.tag, child.value),
      );

      const attrs: Record<string, string> = {};
      attrs.markup = '* ';

      ctx.closeNode('list_item', attrs);
    },
  };
}
