import { type NodeSpec, type NodeType } from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

export class NodeParagraph extends Node {
  override name = 'paragraph';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      attrs: {
        textAlign: { default: null },
      },
      parseDOM: [
        {
          tag: 'p',
          getAttrs(dom) {
            const element = dom as HTMLElement;
            const style = element.style.textAlign;
            if (
              style === 'center' || style === 'right' || style === 'justify'
            ) {
              return { textAlign: style };
            }
            return { textAlign: null };
          },
        },
      ],
      toDOM(node) {
        const align = node.attrs.textAlign as TextAlign | null;
        if (align && align !== 'left') {
          return ['p', { style: `text-align: ${align}` }, 0];
        }
        return ['p', 0];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'setParagraph': () => editor.commandFactories.setBlockType(type),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-0': 'setParagraph',
    };
  }
}
