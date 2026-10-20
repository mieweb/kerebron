import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import {
  DiagnosticsMeta,
  DiagnosticsPlugin,
  DiagnosticsPluginKey,
} from './DiagnosticsPlugin.ts';

import { HoverMatch, HoverSource, HoverTrigger } from '../hover/types.ts';
import { KerebronPopup } from '../popup/types.ts';
import { Ui } from '../Ui.ts';

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

    const publishDiagnostics: CommandFactory = (
      uri,
      version,
      diagnostics,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;

        const meta: DiagnosticsMeta = {
          publishDiagnostics: { uri, version, diagnostics },
        };

        tr.setMeta(DiagnosticsPluginKey, meta);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const addDiagnosticHover: CommandFactory = () => {
      const ui: Ui = this.editor.ci.resolve('ui');

      return (state, dispatch) => {
        if (dispatch) {
          const source3: HoverSource = {
            match: (trigger: HoverTrigger): HoverMatch | undefined => {
              const diagnosticsState = DiagnosticsPluginKey.getState(
                this.editor.state,
              );
              if (!diagnosticsState) {
                return;
              }
              if (trigger.uri) { // TODO trigger.uri
                const diags = diagnosticsState.uriToDiagnostics[trigger.uri];
                console.log(
                  'eee3',
                  trigger.uri,
                  diags,
                  Object.keys(diagnosticsState.uriToDiagnostics),
                );
                if (!diags) {
                  return;
                }

                if (diags.version !== this.editor.version) {
                  return;
                }
                const filtered = diags.diagnostics.filter((d) =>
                  d.range.from <= trigger.pos && trigger.pos < d.range.to
                );

                if (filtered.length > 0) {
                  const first = filtered[0];
                  const text = this.editor.state.doc.textBetween(
                    first.range.from,
                    first.range.to,
                  );

                  return {
                    range: first.range,
                    meta: first.message,
                    text,
                  };
                }
              }
            },
            processRequest: async function (
              trigger,
              match: HoverMatch,
              createPopup: () => KerebronPopup,
            ) {
              const text = match.meta;

              const popup = createPopup();
              ui.setPopupContent(popup, ['markdown', text]);

              return { ...match };
            },
          };

          this.editor.chain().addHoverSource(source3).run();
        }

        return true;
      };
    };

    return {
      publishDiagnostics,
      addDiagnosticHover,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      new DiagnosticsPlugin(this.config, this.editor),
    ];
  }
}
