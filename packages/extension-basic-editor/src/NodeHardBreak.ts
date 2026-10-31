import type { NodeSpec, NodeType } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { type CoreEditor, Node } from '@kerebron/editor';
import {
  Command,
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

export class NodeHardBreak extends Node {
  override name = 'br';
  requires = ['doc'];

  options = {
    keepMarks: true,
  };

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: false,
      linebreakReplacement: true,
      parseDOM: [{ tag: 'br' }],
      toDOM() {
        return ['br'];
      },
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    const setHardBreak: Command = (
      state: EditorState,
      dispatch?: (tr: Transaction) => void,
    ) => {
      const { selection, storedMarks } = state;

      if (selection.$from.parent.type.spec.isolating) {
        return false;
      }

      const { keepMarks } = this.options;

      const splittableMarks: string[] = Object.keys(state.schema.marks).filter(
        (name) => name !== 'link',
      );

      const marks = storedMarks ||
        (selection.$to.parentOffset && selection.$from.marks());

      const tr = state.tr;
      const newContent = state.schema.node(type);

      const { from, to } = tr.selection;

      tr.replaceWith(from, to, newContent);

      if (dispatch && marks && keepMarks) {
        const filteredMarks = marks
          .filter((mark) => splittableMarks.includes(mark.type.name));
        tr.ensureMarks(filteredMarks);
      }

      if (dispatch) {
        dispatch(tr);
      }

      return tr.docChanged;
    };

    return {
      'setHardBreak': () => setHardBreak,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    // https://stackoverflow.com/a/73619128
    const mac = typeof navigator != 'undefined'
      ? /Mac|iP(hone|[oa]d)/.test(navigator?.platform)
      : false;

    const shortcuts: Partial<CommandShortcuts> = {
      'Ctrl-Enter': 'setHardBreak',
    };
    if (mac) {
      shortcuts['Mod-Enter'] = 'setHardBreak';
      shortcuts['Shift-Enter'] = 'setHardBreak';
    }

    return shortcuts;
  }
}
