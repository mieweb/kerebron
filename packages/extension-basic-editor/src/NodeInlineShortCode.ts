import { Node as PmNode, NodeSpec, NodeType } from 'prosemirror-model';
import { Node } from '@kerebron/editor';
import {
  type InputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';

export class NodeInlineShortCode extends Node {
  override name = 'shortcode-inline';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: true,
      attrs: {
        name: {},
      },
      atom: true,
      parseDOM: [{ tag: 'span.kb-shortcode-inline' }],
      toDOM(mark) {
        return ['span', { class: 'kb-shortcode-inline' }, 0];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      wrappingInputRule(
        /\{\{[^}]+\}\}/,
        type,
        (match: RegExpMatchArray) => {
          return { condition: match[0] };
        },
        (match: RegExpMatchArray, node: PmNode) => {
          return node.attrs.condition === match[1];
        },
      ),
    ];
  }
}
