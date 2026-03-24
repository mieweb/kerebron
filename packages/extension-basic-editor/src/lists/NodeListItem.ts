import { Node as PMNode, NodeSpec, type NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  getHtmlAttributes,
  setHtmlAttributes,
} from '@kerebron/editor/utilities';
import { liftListItem, sinkListItem, splitListItem } from './commands.ts';

export class NodeListItem extends Node {
  override name = 'list_item';
  requires = ['doc'];

  override attributes = {
    value: {
      default: undefined,
    },
    type: {
      default: undefined,
      fromDom(element: HTMLElement) {
        return element.hasAttribute('type')
          ? element.getAttribute('type')
          : undefined;
      },
      toDom(node: PMNode) {
        return node.attrs.type;
      },
    },
  };

  override getNodeSpec(): NodeSpec {
    return {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{
        tag: 'li',
        getAttrs: (element) => setHtmlAttributes(this, element),
      }],
      toDOM: (node) => {
        return ['li', getHtmlAttributes(this, node), 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'splitListItem': () => splitListItem(type),
      'liftListItem': () => liftListItem(type),
      'sinkListItem': () => sinkListItem(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Enter': 'splitListItem',
      'Tab': 'sinkListItem',
      'Shift-Tab': 'liftListItem',
    };
  }
}
