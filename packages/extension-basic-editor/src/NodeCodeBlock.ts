import type { NodeSpec, NodeType } from 'prosemirror-model';
import { Node } from '@kerebron/editor';
import {
  type InputRule,
  textblockTypeInputRule,
} from '@kerebron/editor/plugins/input-rules';

export class NodeCodeBlock extends Node {
  override name = 'code_block';

  override getNodeSpec(): NodeSpec {
    // const langs = this.config.languageWhitelist || LANGS;

    return {
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs(dom: HTMLElement) {
            let lang = dom.getAttribute('lang');

            // if (!lang) {
            //   for (const className of dom.classList) {
            //     if (
            //       className.startsWith('lang-') &&
            //       langs.indexOf(className.substring('lang-'.length)) > -1
            //     ) {
            //       lang = className.substring('lang-'.length);
            //       break;
            //     }
            //   }
            // }

            return {
              lang,
            };
          },
        },
      ],
      attrs: { lang: { default: null } },
      toDOM(node) {
        const { lang } = node.attrs;
        return ['pre', { lang }, ['code', 0]];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    /// Given a code block node type, returns an input rule that turns a
    /// textblock starting with three backticks into a code block.
    return [
      textblockTypeInputRule(/^```$/, type),
    ];
  }
}
