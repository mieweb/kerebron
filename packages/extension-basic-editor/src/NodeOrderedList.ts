import { NodeSpec, NodeType } from 'prosemirror-model';

import { CoreEditor, Node } from '@kerebron/editor';
import { getHtmlAttributes } from '@kerebron/editor/utilities';

import {
  type InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';
import {
  type Commands,
  type CommandShortcuts,
  wrapInList,
} from '@kerebron/editor/commands';
import { setHtmlAttributes } from '@kerebron/editor/utilities';

export class NodeOrderedList extends Node {
  override name = 'ordered_list';
  requires = ['doc'];

  attributes = {
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

  override getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    return {
      'toggleOrderedList': () => wrapInList(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-9': 'toggleOrderedList',
    };
  }

  automerge = {
    block: 'ordered_list',
  };
}
