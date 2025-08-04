import { history, redo, undo } from 'prosemirror-history';
import { Command, Plugin } from 'prosemirror-state';

import { type CoreEditor, Extension } from '@kerebron/editor';
import {
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

/// This is a command that will undo an input rule, if applying such a
/// rule was the last thing that the user did.
export const undoInputRule: Command = (state, dispatch) => {
  let plugins = state.plugins;
  for (let i = 0; i < plugins.length; i++) {
    let plugin = plugins[i], undoable;
    if (
      (plugin.spec as any).isInputRules && (undoable = plugin.getState(state))
    ) {
      if (dispatch) {
        let tr = state.tr, toUndo = undoable.transform;
        for (let j = toUndo.steps.length - 1; j >= 0; j--) {
          tr.step(toUndo.steps[j].invert(toUndo.docs[j]));
        }
        if (undoable.text) {
          let marks = tr.doc.resolve(undoable.from).marks();
          tr.replaceWith(
            undoable.from,
            undoable.to,
            state.schema.text(undoable.text, marks),
          );
        } else {
          tr.delete(undoable.from, undoable.to);
        }
        dispatch(tr);
      }
      return true;
    }
  }
  return false;
};

export class ExtensionHistory extends Extension {
  name = 'history';

  options = {
    depth: 100,
    newGroupDelay: 500,
  };

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    return {
      'undo': () => undo,
      'redo': () => redo,
      'undoInputRule': () => undoInputRule,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    // https://stackoverflow.com/a/73619128
    const mac = typeof navigator != 'undefined'
      ? /Mac|iP(hone|[oa]d)/.test(navigator?.platform)
      : false;

    const shortcuts = {
      'Backspace': 'undoInputRule',
      'Mod-z': 'undo',
      'Mod-y': 'redo',
    };
    if (!mac) {
      shortcuts['Mod-y'] = 'redo';
    }

    return shortcuts;
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      history(this.options),
    ];
  }
}
