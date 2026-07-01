import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import {
  DiagnosticsPlugin,
  DiagnosticsPluginKey,
} from './DiagnosticsPlugin.ts';
import { DiagnosticsConfig, DiagnosticsSource } from './types.ts';

export class ExtensionDiagnostics extends Extension {
  name = 'diagnostics';

  public constructor(
    public override config: DiagnosticsConfig = {},
  ) {
    super(config);
  }

  override getCommandFactories(): Partial<CommandFactories> {
    const addDiagnosticsSource: CommandFactory = (
      diagnosticsSource: DiagnosticsSource,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(DiagnosticsPluginKey, {
          addDiagnosticsSource: { diagnosticsSource },
        });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      addDiagnosticsSource,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      new DiagnosticsPlugin(this.config, this.editor),
    ];
  }
}
