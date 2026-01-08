import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';

import { Extension } from '@kerebron/editor';
import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { userColors } from '@kerebron/extension-yjs/userColors';
import { ExtensionYjs, YjsProvider } from '@kerebron/extension-yjs';

export class YjsEditorKit implements EditorKit {
  name = 'yjs-editor';
  requires: AnyExtensionOrReq[];

  static createFrom(ydoc: Y.Doc, roomId: string) {
    const userColor = userColors[random.uint32() % userColors.length];
    if (!roomId) {
      throw new Error('No room id');
    }

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsProvider: YjsProvider = new WebsocketProvider(
      protocol + '//' + globalThis.location.host + '/yjs',
      roomId,
      ydoc,
    );

    wsProvider.on('status', (event) => {
      console.log('wsProvider status', event.status); // logs "connected" or "disconnected"
    });

    wsProvider.awareness.setLocalStateField('user', {
      name: 'Anonymous ' + Math.floor(Math.random() * 100),
      color: userColor.color,
      colorLight: userColor.light,
    });

    return new YjsEditorKit(wsProvider, ydoc);
  }

  constructor(private wsProvider: YjsProvider, private ydoc: Y.Doc) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionYjs({ ydoc: this.ydoc, provider: this.wsProvider }),
    ];
  }
}
