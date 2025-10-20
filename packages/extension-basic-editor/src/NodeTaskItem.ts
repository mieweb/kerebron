import {
  Node as PmNode,
  NodeSpec,
  type NodeType,
} from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { wrappingInputRule } from '@kerebron/editor/plugins/input-rules';
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from '@kerebron/extension-basic-editor/NodeListItem';
import { NodeViewConstructor } from '../../editor/src/DummyEditorView.ts';
import { EditorView } from 'prosemirror-view';

/**
 * Matches a task item to a - [ ] on input.
 */
export const inputRegex = /^\s*(\[([( |x])?\])\s$/;

export interface TaskItemOptions {
  onReadOnlyChecked?: (node: PmNode, checked: boolean) => boolean;
  nested: boolean;
}

export class NodeTaskItem extends Node {
  override name = 'task_item';
  requires = ['doc'];

  public constructor(protected override config: Partial<TaskItemOptions> = {}) {
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
      parseDOM: [{
        tag: 'li[data-checked]',
        getAttrs(node) {
          return {
            checked: node.getAttribute('data-checked') === 'true',
          };
        },
      }],
      defining: true,
      toDOM(node) {
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
            ],
            ['span'],
          ],
          ['div', 0],
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
    return (node: PmNode, view: EditorView, getPos) => {
      const listItem = document.createElement('li');
      const checkboxWrapper = document.createElement('label');
      const checkboxStyler = document.createElement('span');
      const checkbox = document.createElement('input');
      const content = document.createElement('div');

      checkboxWrapper.contentEditable = 'false';
      checkbox.type = 'checkbox';
      checkbox.addEventListener('mousedown', (event) => event.preventDefault());
      checkbox.addEventListener('change', (event) => {
        const isEditable = true; // TODO editor.isEditable

        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!isEditable && !this.config.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked;

          return;
        }

        const { checked } = event.target as any;

        if (isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos();

              if (typeof position !== 'number') {
                return false;
              }
              const currentNode = tr.doc.nodeAt(position);

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
              });

              return true;
            })
            .run();
        }
        if (!isEditable && this.config.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          if (!this.config.onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked;
          }
        }
      });

      listItem.dataset.checked = node.attrs.checked;
      checkbox.checked = node.attrs.checked;

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.type) {
            return false;
          }

          listItem.dataset.checked = updatedNode.attrs.checked;
          checkbox.checked = updatedNode.attrs.checked;

          return true;
        },
      };
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
