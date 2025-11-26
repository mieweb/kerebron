import type { Plugin } from 'prosemirror-state';

import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { Extension } from '@kerebron/editor';

import type {
  CommandFactories,
  CommandShortcuts,
} from '@kerebron/editor/commands';
import { ySyncPlugin } from './ySyncPlugin.ts';
import { yPositionPlugin } from './yPositionPlugin.ts';
import { redo, undo, yUndoPlugin } from './yUndoPlugin.ts';
import { initProseMirrorDoc } from './convertUtils.ts';

export interface YjsProvider {
  on(eventName: string, callback: (event: any) => void): void;
  awareness: awarenessProtocol.Awareness;
}

export class ExtensionYjs extends Extension {
  name = 'yjs';

  override conflicts = ['history'];
  requires = ['remote-selection'];

  // declare type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => boolean;
  override getCommandFactories(): Partial<CommandFactories> {
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

  override getProseMirrorPlugins(): Plugin[] {
    const ydoc: Y.Doc = this.config.ydoc;
    const fragment = ydoc.getXmlFragment('prosemirror');

    const { mapping } = initProseMirrorDoc(fragment, this.editor.schema);

    return [
      ySyncPlugin(fragment, { mapping }),
      yPositionPlugin(this.config.provider.awareness, this.editor),
      yUndoPlugin(),
    ];
  }
}
