import { EditorView } from 'prosemirror-view';
import {
  EditorState,
  Plugin,
  PluginKey,
  Selection,
  Transaction,
} from 'prosemirror-state';
import type { NodeSpec, NodeType } from 'prosemirror-model';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  textblockTypeInputRule,
} from '@kerebron/editor/plugins/input-rules';
import { codeJarBlockNodeView } from './codeJarBlockNodeView.ts';
import { getShadowRoot } from '@kerebron/editor/utilities';
import { getLangsList } from '@kerebron/wasm';

export const codeJarBlockKey = new PluginKey('code-jar-block');

function arrowHandler(dir: 'left' | 'right' | 'up' | 'down') {
  return (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    view: EditorView,
  ) => {
    if (state.selection.empty && view.endOfTextblock(dir)) {
      let side = dir == 'left' || dir == 'up' ? -1 : 1;
      let $head = state.selection.$head;
      let nextPos = Selection.near(
        state.doc.resolve(side > 0 ? $head.after() : $head.before()),
        side,
      );
      if (nextPos.$head && nextPos.$head.parent.type.name == 'code_block') {
        dispatch(state.tr.setSelection(nextPos));
        return true;
      }
    }
    return false;
  };
}

export interface NodeCodeJarConfig {
  readOnly?: any;
  languageWhitelist?: string[];
}

export class NodeCodeJar extends Node {
  override name = 'code_block';
  // requires = ['doc'];

  constructor(override config: NodeCodeJarConfig) {
    super(config);
  }

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

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'setCodeBlock': (lang?: string) =>
        editor.commandFactories.setBlockType(type, { lang }),
      // ArrowLeft: () => arrowHandler('left'),
      // ArrowRight: () => arrowHandler('right'),
      // ArrowUp: () => arrowHandler('up'),
      // ArrowDown: () => arrowHandler('down'),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-"': 'setCodeBlock',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
    };
  }

  override getProseMirrorPlugins(editor: CoreEditor): Plugin[] {
    const shadowRoot = getShadowRoot(editor.config.element);

    const settings = {
      languageWhitelist: this.config.languageWhitelist || getLangsList(),
      shadowRoot,
      // ...defaultSettings,
      readOnly: this.config.readOnly,
      // languageLoaders: { ...languageLoaders, ...legacyLanguageLoaders },
      undo: () => {
        editor.chain().undo().run();
      },
      redo: () => {
        editor.chain().redo().run();
      },
      // theme: [...(this.config.theme || [])],
    };

    return [
      new Plugin({
        key: codeJarBlockKey,
        props: {
          nodeViews: {
            [this.name]: codeJarBlockNodeView(settings, editor),
          },
        },
      }),
    ];
  }
}
