import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import {
  CreateWsProvider,
  ExtensionYjs,
  YjsProvider,
} from '@kerebron/extension-yjs';

export class YjsEditorKit implements EditorKit {
  name = 'yjs-editor';

  static createFrom(userName: string, url?: string) {
    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    if (!url) {
      url = protocol + '//' + globalThis.location.host + '/yjs';
    }

    return new YjsEditorKit(url, userName);
  }

  constructor(public url: string, public userName: string) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    const createWsProvider: CreateWsProvider = (roomId: string) => {
      const ydoc = new Y.Doc();
      const wsProvider: YjsProvider = new WebsocketProvider(
        this.url,
        roomId,
        ydoc,
      );

      wsProvider.on('status', (event) => {
        console.log('wsProvider status', event.status); // logs "connected" or "disconnected"
      });

      return [wsProvider, ydoc];
    };

    return [
      new ExtensionYjs({ createWsProvider }),
    ];
  }
}
