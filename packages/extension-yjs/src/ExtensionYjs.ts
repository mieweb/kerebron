import { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { CoreEditor, Extension } from '@kerebron/editor';

import { Commands, CommandShortcuts } from '@kerebron/editor/commands';
import { ySyncPlugin } from './ySyncPlugin.ts';
import { yCursorPlugin } from './yCursorPlugin.ts';
import { redo, undo, yUndoPlugin } from './yUndoPlugin.ts';
import { initProseMirrorDoc } from './lib.ts';

export class ExtensionYjs extends Extension {
  name = 'yjs';
  doc: any;

  // declare type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => boolean;
  override getCommands(editor: CoreEditor): Partial<Commands> {
    return {
      'undo': () => undo,
      'redo': () => redo,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Mod-z': 'undo',
      'Mod-y': 'redo',
    };
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const ydoc = this.config.ydoc;
    const fragment = ydoc.getXmlFragment('prosemirror');

    const { mapping } = initProseMirrorDoc(fragment, schema);

    return [
      ySyncPlugin(fragment, { mapping }),
      yCursorPlugin(this.config.provider.awareness),
      yUndoPlugin(),
    ];
  }
}
