import * as Y from 'yjs';

import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';

import { WebsocketProvider } from './WebsocketProvider.ts';
import { ExtensionYjs, YjsConfig } from './ExtensionYjs.ts';
import { CreateYjsProvider, YjsProvider } from './YjsProvider.ts';

import { MarkYChange } from './MarkYChange.ts';

export class YjsEditorKit implements EditorKit {
  name = 'yjs-editor';

  static createFrom(url?: string | YjsConfig, config?: YjsConfig) {
    if (url && 'object' === typeof url) {
      config = url;
      url = undefined;
    }

    if (!url) {
      const protocol = globalThis.location.protocol === 'http:'
        ? 'ws:'
        : 'wss:';
      url = protocol + '//' + globalThis.location.host + '/yjs';
    }

    const createYjsProvider: CreateYjsProvider = (roomId: string) => {
      const ydoc = new Y.Doc({ gc: false });
      const wsProvider: YjsProvider = new WebsocketProvider(
        url,
        roomId,
        ydoc,
      );

      return [wsProvider, ydoc];
    };

    if (!config) {
      config = { createYjsProvider };
    }

    if (!config.createYjsProvider) {
      config.createYjsProvider = createYjsProvider;
    }

    return new YjsEditorKit(url, config);
  }

  constructor(public url: string, private readonly config: YjsConfig) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new MarkYChange(),
      new ExtensionYjs({ ...this.config }),
    ];
  }
}
