import type { Node, Schema } from 'prosemirror-model';
import type { Plugin } from 'prosemirror-state';

import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { Converter, CoreEditor, Extension } from '@kerebron/editor';
import type {
  CommandFactories,
  CommandShortcuts,
} from '@kerebron/editor/commands';

import { ySyncPluginKey } from './keys.ts';
import { ySyncPlugin } from './ySyncPlugin.ts';
import { yPositionPlugin } from './yPositionPlugin.ts';
import { redo, undo, yUndoPlugin } from './yUndoPlugin.ts';

export interface YjsProvider {
  on(eventName: string, callback: (event: any) => void): void;
  awareness: awarenessProtocol.Awareness;
}

function stringToIndex(str: string, arrayLength: number) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit integer
  }

  return Math.abs(hash) % arrayLength;
}

export type CreateWsProvider = (roomId: string) => [YjsProvider, Y.Doc];

export interface YjsConfig {
  createWsProvider: CreateWsProvider;
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

  constructor(public override config: YjsConfig) {
    super();
  }

  // changeUser(userName: string) {
  //   const idx = stringToIndex(userName, userColors.length);
  //   const userColor = userColors[idx];
  //   this.wsProvider.awareness.setLocalStateField('user', {
  //     name: userName,
  //     color: userColor.color,
  //     colorLight: userColor.light,
  //   });
  // }
  // //

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'yjs': {
        fromDoc: async (document: Node): Promise<Uint8Array> => {
          throw new Error('Not implemented');
        },
        toDoc: async (buffer: Uint8Array): Promise<Node> => {
          const roomId = new TextDecoder().decode(buffer);

          const tr = editor.state.tr.setMeta(ySyncPluginKey, {
            roomId: '',
          });
          editor.view.dispatch(tr);

          setTimeout(() => {
            const tr = editor.state.tr.setMeta(ySyncPluginKey, { roomId });
            editor.view.dispatch(tr);
          }, 100);

          return schema.topNodeType.createAndFill()!;
        },
      },
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      ySyncPlugin(this.editor.schema, this.config.createWsProvider),
      yPositionPlugin(this.editor),
      yUndoPlugin(),
    ];
  }
}
