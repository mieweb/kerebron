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
import { CodeBlockSettings } from './types.ts';
import { codeMirrorBlockNodeView } from './codeMirrorBlockNodeView.ts';
import { defaultSettings } from './defaults.ts';
import languageLoaders, { legacyLanguageLoaders } from './languageLoaders.ts';
import { getShadowRoot } from '@kerebron/editor/utilities';

export const codeMirrorBlockKey = new PluginKey('codemirror-block');

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

const LANGS = [
  'diff',
  'dockerfile',
  'http',
  'nginx',
  'properties',
  'shell',
  'toml',
  'yaml',
  'sql',
  'javascript',
  'cpp',
  'css',
  'xml',
  'java',
  'json',
  'markdown',
  'rust',
  'html',
];

export interface NodeCodeMirrorConfig {
  languageWhitelist?: CodeBlockSettings['languageWhitelist'];
  theme?: CodeBlockSettings['theme'];
}

export class NodeCodeMirror extends Node {
  override name = 'code_block';
  // requires = ['doc'];

  constructor(override config: NodeCodeMirrorConfig) {
    super(config);
  }

  override getNodeSpec(): NodeSpec {
    const langs = this.config.languageWhitelist || LANGS;

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

            if (!lang) {
              for (const className of dom.classList) {
                if (
                  className.startsWith('lang-') &&
                  langs.indexOf(className.substring('lang-'.length)) > -1
                ) {
                  lang = className.substring('lang-'.length);
                  break;
                }
              }
            }

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
      ArrowLeft: () => arrowHandler('left'),
      ArrowRight: () => arrowHandler('right'),
      ArrowUp: () => arrowHandler('up'),
      ArrowDown: () => arrowHandler('down'),
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
      languageWhitelist: this.config.languageWhitelist || LANGS,
      shadowRoot,
      ...defaultSettings,
      readOnly: this.config.readOnly,
      languageLoaders: { ...languageLoaders, ...legacyLanguageLoaders },
      undo: () => {
        editor.chain().undo().run();
      },
      redo: () => {
        editor.chain().redo().run();
      },
      theme: [...(this.config.theme || [])],
    };

    return [
      new Plugin({
        key: codeMirrorBlockKey,
        props: {
          nodeViews: {
            [this.name]: codeMirrorBlockNodeView(settings, editor),
          },
        },
      }),
    ];
  }
}
