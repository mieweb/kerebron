import { Plugin, PluginKey } from 'prosemirror-state';

import { type CoreEditor } from '@kerebron/editor';

import { DiagnosticsConfig, DiagnosticsSource } from './types.ts';

export const DiagnosticsPluginKey = new PluginKey<DiagnosticsState>(
  'diagnostics',
);

class DiagnosticsState {
  diagnosticsSources: DiagnosticsSource[] = [];

  decorationId?: string;

  constructor() {
  }
}

interface DiagnosticsMeta {
  addDiagnosticsSource?: {
    diagnosticsSource: DiagnosticsSource;
  };
  activate?: boolean;
  deactivate?: boolean;
}

export class DiagnosticsPlugin<Item, TSelected>
  extends Plugin<DiagnosticsState> {
  // timeout: undefined | ReturnType<typeof setTimeout>;
  // lastEvent: undefined | MouseEvent;

  constructor(config: DiagnosticsConfig, editor: CoreEditor) {
    super({
      key: DiagnosticsPluginKey,
      state: {
        init() {
          return new DiagnosticsState();
        },

        apply(tr, pluginState, oldState, newState) {
          if (!tr.docChanged) {
            return pluginState;
          }

          // let codeBlockChanged = false;

          // // Compare changed ranges only
          // tr.mapping.maps.forEach((stepMap) => {
          //   stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
          //     oldState.doc.nodesBetween(oldStart, oldEnd, (node) => {
          //       if (node.type.name === 'code_block') {
          //         codeBlockChanged = true;
          //       }
          //     });

          //     newState.doc.nodesBetween(newStart, newEnd, (node) => {
          //       if (node.type.name === 'code_block') {
          //         codeBlockChanged = true;
          //       }
          //     });
          //   });
          // });

          // if (codeBlockChanged) {
          //   console.log("Code block changed");
          //   // trigger your logic here
          // }

          return pluginState;
        },
      },
    });
  }
}
