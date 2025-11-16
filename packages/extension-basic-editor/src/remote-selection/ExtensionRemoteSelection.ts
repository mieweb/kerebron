import { Plugin } from 'prosemirror-state';
import { type CoreEditor, Extension } from '@kerebron/editor';

import { remoteSelectionPlugin } from './remoteSelectionPlugin.ts';

type Color = string;

export interface SelectionState {
  clientId: number;
  user: {
    name: string;
    color: Color;
    colorLight: Color;
  };
  cursor?: {
    anchor: number;
    head: number;
  };
}

export { remoteSelectionPluginKey } from './remoteSelectionPlugin.ts';

export class ExtensionRemoteSelection extends Extension {
  override name = 'remote-selection';

  private remoteStates: SelectionState[] = [];

  override getProseMirrorPlugins(editor: CoreEditor): Plugin[] {
    return [
      remoteSelectionPlugin(this, editor),
    ];
  }

  getRemoteStates(): SelectionState[] {
    return this.remoteStates;
  }

  setRemoteStates(states: SelectionState[]) {
    this.remoteStates = states;
    const event = new CustomEvent('remoteSelectionChange', {
      detail: {},
    });
    this.editor.dispatchEvent(event);
  }
}
