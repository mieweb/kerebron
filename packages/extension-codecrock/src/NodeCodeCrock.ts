import { EditorView, NodeViewConstructor } from 'prosemirror-view';
import {
  EditorState,
  PluginKey,
  Selection,
  Transaction,
} from 'prosemirror-state';
import type { NodeType } from 'prosemirror-model';

import { type CoreEditor } from '@kerebron/editor';
import { getShadowRoot } from '@kerebron/editor/utilities';
import {
  Command,
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

import { getLangsList } from '@kerebron/wasm';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';

import { NodeViewCodeCrock } from './NodeViewCodeCrock.ts';

export const codeCrockBlockKey = new PluginKey('code-crock-block');

function arrowHandler(dir: 'left' | 'right' | 'up' | 'down'): Command {
  return function (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) {
    if (!view) {
      return false;
    }
    if (state.selection.empty && view.endOfTextblock(dir)) {
      let side = dir == 'left' || dir == 'up' ? -1 : 1;
      let $head = state.selection.$head;
      let nextPos = Selection.near(
        state.doc.resolve(side > 0 ? $head.after() : $head.before()),
        side,
      );
      if (nextPos.$head && nextPos.$head.parent.type.name == 'code_block') {
        if (dispatch) {
          dispatch(state.tr.setSelection(nextPos));
        }
        return true;
      }
    }
    return false;
  };
}

export interface NodeCodeCrockConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export class NodeCodeCrock extends NodeCodeBlock {
  constructor(override config: NodeCodeCrockConfig) {
    super(config);
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

  override getNodeView(editor: CoreEditor): NodeViewConstructor {
    return (...args) => {
      const node = args[0];

      const shadowRoot = getShadowRoot(this.editor.config.element);
      const settings = {
        languageWhitelist: this.config.languageWhitelist || getLangsList(),
        shadowRoot,
        readOnly: this.editor.config.readOnly || this.config.readOnly,
        undo: () => {
          this.editor.chain().undo().run();
        },
        redo: () => {
          this.editor.chain().redo().run();
        },
      };

      const nodeView = new NodeViewCodeCrock(editor, settings, ...args);
      nodeView.init();
      return nodeView;
    };
  }
}
