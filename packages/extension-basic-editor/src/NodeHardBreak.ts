import type { NodeSpec, NodeType } from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
  exitCode,
} from '@kerebron/editor/commands';
import { firstCommand } from '@kerebron/editor/commands';

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
    // TODO: refactor commands
    // const comm2: Command = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    //   const { selection, storedMarks } = state

    //   if (selection.$from.parent.type.spec.isolating) {
    //       return false
    //   }

    //   const { keepMarks } = this.options
    //   // const { splittableMarks } = editor.extensionManager
    //   const splittableMarks = [];
    //   const marks = storedMarks
    //       || (selection.$to.parentOffset && selection.$from.marks())

    //   return editor.chain()
    //     .insertContent({ type: this.name })
    //     .command(({ tr, dispatch }) => {
    //         if (dispatch && marks && keepMarks) {
    //           for (const mark of marks) {
    //             console.log('mteset', mark.type);
    //           }
    //             const filteredMarks = marks
    //                 .filter(mark => splittableMarks.includes(mark.type.name))

    //             tr.ensureMarks(filteredMarks)
    //         }

    //         return true
    //     })
    //     .run();
    // }

    const setHardBreak = firstCommand(
      exitCode,
      // comm2
    );

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
