import type { NodeSpec, NodeType } from 'prosemirror-model';
import { Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import { normalizeLang } from '@kerebron/wasm';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Convert a ``` or ```lang fence paragraph into a code block.
     * Bound to Enter for paragraphs that consist solely of a fence.
     */
    setCodeBlockFromFence: () => ReturnType;
  }
}

const FENCE_RE = /^```([a-zA-Z0-9+#-]*)$/;

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
      attrs: { lang: { default: undefined }, id: { default: undefined } },
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
      toDOM(node) {
        const { lang } = node.attrs;
        return ['pre', { lang }, ['code', 0]];
      },
    };
  }

  override getCommandFactories(
    editor: Parameters<Node['getCommandFactories']>[0],
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'setCodeBlockFromFence': () => {
        return (state, dispatch) => {
          const { $from } = state.selection;
          const parent = $from.parent;
          if (parent.type.spec.code) return false;

          const match = FENCE_RE.exec(parent.textContent);
          if (!match) return false;
          if (!dispatch) return true;

          const start = $from.before();
          const end = $from.after();
          const lang = match[1] ? normalizeLang(match[1]) : undefined;

          const tr = state.tr;

          const node = type.createAndFill({ lang, id: crypto.randomUUID() });
          if (node) {
            tr.insert(tr.mapping.map(start), node);
            tr.delete(tr.mapping.map(start), tr.mapping.map(end));
          }

          dispatch(tr);
          return true;
        };
      },
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Enter': 'setCodeBlockFromFence',
    };
  }
}
