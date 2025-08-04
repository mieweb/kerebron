import { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  getHtmlAttributes,
  setHtmlAttributes,
} from '@kerebron/editor/utilities';

import {
  type InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';
import {
  type CommandFactories,
  type CommandShortcuts,
  wrapInList,
} from '@kerebron/editor/commands';

export class NodeOrderedList extends Node {
  override name = 'ordered_list';
  requires = ['doc'];

  override attributes = {
    type: {
      default: '1',
      fromDom(element: HTMLElement) {
        return element.hasAttribute('type')
          ? element.getAttribute('type')
          : '1';
      },
    },
    start: {
      default: 1,
      fromDom(element: HTMLElement) {
        return element.hasAttribute('start')
          ? +element.getAttribute('start')!
          : 1;
      },
    },
  };

  override getNodeSpec(): NodeSpec {
    return {
      group: 'block',
      content: 'list_item+',
      parseDOM: [
        { tag: 'ol', getAttrs: (element) => setHtmlAttributes(this, element) },
      ],
      toDOM: (node) => ['ol', getHtmlAttributes(this, node), 0],
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      /// Given a list node type, returns an input rule that turns a number
      /// followed by a dot at the start of a textblock into an ordered list.
      wrappingInputRule(
        /^(\d+)\.\s$/,
        type,
        (match) => ({ order: +match[1] }),
        (match, node) => node.childCount + node.attrs.order == +match[1],
      ),
    ];
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'toggleOrderedList': () => wrapInList(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-9': 'toggleOrderedList',
    };
  }
}
