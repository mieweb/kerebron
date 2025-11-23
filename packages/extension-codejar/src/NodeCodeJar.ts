import { EditorView } from 'prosemirror-view';
import {
  EditorState,
  Plugin,
  PluginKey,
  Selection,
  Transaction,
} from 'prosemirror-state';
import type { NodeType } from 'prosemirror-model';

import { type CoreEditor } from '@kerebron/editor';
import { getShadowRoot } from '@kerebron/editor/utilities';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

import { getLangsList } from '@kerebron/wasm';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';

import { codeJarBlockNodeView } from './codeJarBlockNodeView.ts';

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

export class NodeCodeJar extends NodeCodeBlock {
  constructor(override config: NodeCodeJarConfig) {
    super(config);
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

  override getProseMirrorPlugins(): Plugin[] {
    const shadowRoot = getShadowRoot(this.editor.config.element);

    const settings = {
      languageWhitelist: this.config.languageWhitelist || getLangsList(),
      shadowRoot,
      // ...defaultSettings,
      readOnly: this.config.readOnly,
      // languageLoaders: { ...languageLoaders, ...legacyLanguageLoaders },
      undo: () => {
        this.editor.chain().undo().run();
      },
      redo: () => {
        this.editor.chain().redo().run();
      },
      // theme: [...(this.config.theme || [])],
    };

    return [
      new Plugin({
        key: codeJarBlockKey,
        props: {
          nodeViews: {
            [this.name]: codeJarBlockNodeView(settings, this.editor),
          },
        },
      }),
    ];
  }
}
