import { Node as PmNode, NodeSpec, type NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { wrappingInputRule } from '@kerebron/editor/plugins/input-rules';
import { liftListItem, sinkListItem, splitListItem } from './commands.ts';
import { NodeViewConstructor } from '@kerebron/editor/DummyEditorView';
import { NodeViewTaskItem } from './NodeViewTaskItem.ts';

export interface TaskItemOptions {
  onReadOnlyChecked?: (node: PmNode, checked: boolean) => boolean;
  nested: boolean;
}

export class NodeTaskItem extends Node {
  override name = 'task_item';
  requires = ['doc'];

  public constructor(
    protected override config: Partial<TaskItemOptions> = { nested: true },
  ) {
    super(config);
  }

  override getNodeSpec(): NodeSpec {
    return {
      attrs: {
        checked: {
          default: false,
        },
      },
      content: this.config.nested ? 'paragraph block*' : 'paragraph+',
      defining: true,
      parseDOM: [{
        tag: 'li[data-checked]',
        getAttrs(node) {
          return {
            checked: node.getAttribute('data-checked') === 'true',
          };
        },
      }],
      toDOM: (node) => {
        return [
          'li',
          {
            'data-type': this.name,
            'data-checked': node.attrs.checked,
          },
          [
            'label',
            [
              'input',
              {
                type: 'checkbox',
                checked: node.attrs.checked ? 'checked' : null,
              },
              ['span'],
            ],
            ['div', 0],
          ],
        ];
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

  override getNodeView(editor: CoreEditor): NodeViewConstructor {
    return (...args) => {
      return NodeViewTaskItem.create(editor, ...args);
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Enter': 'splitListItem',
      'Tab': 'sinkListItem',
      'Shift-Tab': 'liftListItem',
    };
  }

  override getInputRules(type: NodeType) {
    const inputRegex = /^\s*(\[([( |x])?\])\s$/;

    return [
      wrappingInputRule(
        inputRegex,
        type,
        (match) => ({
          checked: match[match.length - 1] === 'x',
        }),
      ),
    ];
  }
}
