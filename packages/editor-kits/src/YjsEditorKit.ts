import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import {
  CreateWsProvider,
  ExtensionYjs,
  YjsProvider,
} from '@kerebron/extension-yjs';

import { MarkYChange } from '@kerebron/extension-yjs/MarkYChange';

export class YjsEditorKit implements EditorKit {
  name = 'yjs-editor';

  static createFrom(userName: string, url?: string) {
    if (!url) {
      const protocol = globalThis.location.protocol === 'http:'
        ? 'ws:'
        : 'wss:';
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
      new MarkYChange(),
      new ExtensionYjs({ createWsProvider }),
    ];
  }
}
