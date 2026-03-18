import { Plugin } from 'prosemirror-state';
import { Extension } from '@kerebron/editor';
import { type User } from '@kerebron/editor/user';

import { remoteSelectionPlugin } from './remoteSelectionPlugin.ts';

export interface SelectionState {
  clientId: number;
  user: User;
  cursor?: {
    anchor: number;
    head: number;
  };
}

export { remoteSelectionPluginKey } from './remoteSelectionPlugin.ts';

export class ExtensionRemoteSelection extends Extension {
  override name = 'remote-selection';

  override getProseMirrorPlugins(): Plugin[] {
    return [
      remoteSelectionPlugin(),
    ];
  }
}
