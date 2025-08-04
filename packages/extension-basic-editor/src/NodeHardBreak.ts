import type { NodeSpec, NodeType } from 'prosemirror-model';
import { type CoreEditor, Node } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
  exitCode,
} from '@kerebron/editor/commands';

export class NodeHardBreak extends Node {
  override name = 'br';
  requires = ['doc'];

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

  /*if (!exitCode(view.state, view.dispatch)) return false
  view.focus()
  return true
}},*/

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      // 'first': commands => first(commands),
      'setHardBreak': () => (state, dispatch) => {
        if (!exitCode(state, dispatch)) {
          return false;
        }
        editor.view.focus();
        if (dispatch) {
          dispatch(
            state.tr.replaceSelectionWith(type.create()).scrollIntoView(),
          );
        }
        return true;
      },
      // const commands = editor.commands;
      // return commands.first([
      //     () => commands.exitCode(),
      //     () => commands.command(() => {
      //         const { selection, storedMarks } = state
      //
      //         if (selection.$from.parent.type.spec.isolating) {
      //             return false
      //         }
      //
      //         const { keepMarks } = this.options
      //         const { splittableMarks } = editor.extensionManager
      //         const marks = storedMarks
      //             || (selection.$to.parentOffset && selection.$from.marks())
      //
      //         return chain()
      //             .insertContent({ type: this.name })
      //             .command(({ tr, dispatch }) => {
      //                 if (dispatch && marks && keepMarks) {
      //                     const filteredMarks = marks
      //                         .filter(mark => splittableMarks.includes(mark.type.name))
      //
      //                     tr.ensureMarks(filteredMarks)
      //                 }
      //
      //                 return true
      //             })
      //             .run()
      //     }),
      // ])
      // chainCommands(exitCode, (state, dispatch) => {
      //     if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView())
      //     return true
      // })
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
