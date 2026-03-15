import * as Y from 'yjs';
import { WebsocketProvider } from '@kerebron/extension-yjs/WebsocketProvider';

import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import {
  CreateYjsProvider,
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
    const createYjsProvider: CreateYjsProvider = (roomId: string) => {
      const ydoc = new Y.Doc();
      const wsProvider: YjsProvider = new WebsocketProvider(
        this.url,
        roomId,
        ydoc,
      );

      wsProvider.addEventListener('status', (event) => {
        console.log('wsProvider status', event.detail.status); // logs "connected" or "disconnected"
      });

      return [wsProvider, ydoc];
    };

    return [
      new MarkYChange(),
      new ExtensionYjs({ createYjsProvider }),
    ];
  }
}
