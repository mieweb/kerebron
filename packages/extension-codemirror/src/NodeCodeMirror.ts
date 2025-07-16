import { EditorState, Plugin, PluginKey, Selection } from 'prosemirror-state';
import type { NodeSpec, NodeType, Schema } from 'prosemirror-model';

import { Converter, type CoreEditor, Node } from '@kerebron/editor';
import {
  type Commands,
  type CommandShortcuts,
  setBlockType,
} from '@kerebron/editor/commands';
import {
  type InputRule,
  textblockTypeInputRule,
} from '@kerebron/editor/plugins/input-rules';
import { CodeBlockSettings } from './types.ts';
import { codeMirrorBlockNodeView } from './codeMirrorBlockNodeView.ts';
import { defaultSettings } from './defaults.ts';
import languageLoaders, { legacyLanguageLoaders } from './languageLoaders.ts';
import { createNodeFromObject } from '@kerebron/editor/utilities';

export const codeMirrorBlockKey = new PluginKey('codemirror-block');

function arrowHandler(dir: 'left' | 'right' | 'up' | 'down') {
  return (state: EditorState, dispatch, view) => {
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

export class NodeCodeMirror extends Node {
  override name = 'code_block';
  // requires = ['doc'];

  automerge = {
    block: this.name,
    attrParsers: {
      fromAutomerge: (block) => ({ lang: block.attrs.lang }),
      fromProsemirror: (node) => ({ lang: node.attrs.lang }),
    },
  };

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/code-only': {
        fromDoc(document: any) {
          const retVal = [];
          if (document.content) {
            for (const node of document.content.toJSON()) {
              if ('code_block' === node.type && Array.isArray(node.content)) {
                for (const content of node.content) {
                  retVal.push(content.text);
                }
              }
            }
          }
          return retVal.join('');
        },
        toDoc(code: string) {
          const content = {
            'type': 'doc_code',
            'content': [
              {
                'type': 'code_block',
                'attrs': {
                  'lang': schema.topNodeType.spec.defaultAttrs?.lang,
                },
                'content': [
                  {
                    'type': 'text',
                    'text': code,
                  },
                ],
              },
            ],
          };

          return createNodeFromObject(
            content,
            schema,
            {
              slice: false,
              errorOnInvalidContent: false,
            },
          );
        },
      },
    };
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
                if (className.startsWith('lang-') && langs.indexOf(className.substring('lang-'.length)) > -1) {
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

  override getCommands(editor: CoreEditor, type: NodeType): Partial<Commands> {
    return {
      'setCodeBlock': (lang?: string) => setBlockType(type, { lang }),
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
    const codeMirrorBlockPlugin = (settings: CodeBlockSettings) =>
      new Plugin({
        key: codeMirrorBlockKey,
        props: {
          nodeViews: {
            [this.name]: codeMirrorBlockNodeView(settings),
          },
        },
      });

    return [
      codeMirrorBlockPlugin({
        provider: this.config.provider,
        languageWhitelist: this.config.languageWhitelist || LANGS,
        shadowRoot: this.config.shadowRoot,
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
      }),
      // keymap(codeBlockKeymap),
    ];
  }
}
