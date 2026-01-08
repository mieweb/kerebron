import { Node as PmNode, NodeSpec, NodeType } from 'prosemirror-model';
import { Node } from '@kerebron/editor';
import {
  type InputRule,
  replaceInlineNode,
  textblockTypeInputRule,
  wrappingInputRule,
} from '@kerebron/editor/plugins/input-rules';

export function fixCharacters(text: string) {
  return text
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    // deno-lint-ignore no-control-regex
    .replace(/\x0b/g, ' ')
    .replace(/\u201d/g, '"')
    .replace(/\u201c/g, '"');
}

export class NodeInlineShortCode extends Node {
  override name = 'shortcode_inline';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: true,
      attrs: {
        content: {
          default: '',
        },
      },
      atom: true,
      parseDOM: [{
        tag: 'span.kb-shortcode-inline',
        getAttrs: (dom) => ({ content: dom.textContent || null }),
      }],
      toDOM(node) {
        return [
          'span',
          { class: 'kb-shortcode-inline' },
          node.attrs.content || '',
        ];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      replaceInlineNode(
        /\{\{[^}]+\}\}/,
        type,
        (match: RegExpMatchArray) => {
          const content = fixCharacters(
            match[0].substring(2, match[0].length - 2),
          );
          return { content };
        },
      ),
    ];
  }
}
