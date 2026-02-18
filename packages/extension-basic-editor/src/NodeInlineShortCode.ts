import { Node as PmNode, NodeSpec, NodeType, Schema } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { Node } from '@kerebron/editor';
import {
  type InputRule,
  replaceInlineNode,
} from '@kerebron/editor/plugins/input-rules';
import { CoreEditor } from '@kerebron/editor';
import { CommandFactories, NESTING_SELF_CLOSING } from '@kerebron/editor';
import { Command } from '@kerebron/editor/commands';

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

type Factory = (oldNode: PmNode, schema: Schema) => PmNode;

function replaceAllNodesOfType(
  tr: Transaction,
  doc: PmNode,
  oldType: NodeType,
  factory: Factory,
) {
  const replacements: Array<{ node: PmNode; pos: number }> = [];

  doc.descendants((node, pos) => {
    if (node.type === oldType) {
      replacements.push({ node, pos });
    }
  });

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { node, pos } = replacements[i];
    const newNode = factory(node, tr.doc.type.schema);
    tr = tr.replaceWith(pos, pos + node.nodeSize, newNode);
  }

  return tr;
}

export class NodeInlineShortCode extends Node {
  override name = 'shortcode_inline';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: true,
      atom: true,
      attrs: {
        content: {
          default: '',
        },
        nesting: {
          default: NESTING_SELF_CLOSING,
        },
        error: {
          default: '',
        },
      },
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

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'renderShortCode': (createReplacementNode: Factory): Command => {
        return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
          let tr = state.tr;

          tr = replaceAllNodesOfType(
            tr,
            state.doc,
            type,
            createReplacementNode,
          );

          if (tr.docChanged && dispatch) {
            dispatch(tr);
          }

          return true;
        };
      },
    };
  }
}
